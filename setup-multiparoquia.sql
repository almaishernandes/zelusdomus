-- ═══════════════════════════════════════════════════════════════════════════
-- ZelusDomus — Suporte a VÁRIAS PARÓQUIAS (multi-tenant)
-- Rodar UMA VEZ no Supabase SQL Editor.
--
-- Modelo escolhido:
--  • Isolamento total: cada coordenador/servidor só enxerga a própria paróquia.
--  • Formação é própria de cada paróquia.
--  • Paróquias e coordenadores são criados manualmente (sem auto-cadastro).
--
-- Estratégia: uma coluna paroquia_id em cada tabela, com DEFAULT que puxa a
-- paróquia do usuário logado — assim os INSERT do app se preenchem sozinhos e
-- o app quase não muda. O RLS passa a exigir paroquia_id = paróquia do usuário.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Tabela de paróquias ────────────────────────────────────────────────
create table if not exists paroquias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cidade text,
  diocese text,
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);

alter table paroquias enable row level security;

-- ── 2. Coluna paroquia_id nos perfis ─────────────────────────────────────
alter table coordenador_profiles add column if not exists paroquia_id uuid references paroquias(id);
alter table servidor_profiles   add column if not exists paroquia_id uuid references paroquias(id);

-- ── 3. Função: paróquia do usuário logado ────────────────────────────────
-- SECURITY DEFINER para poder ler os *_profiles sem esbarrar no próprio RLS.
create or replace function zd_paroquia_atual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select paroquia_id from coordenador_profiles where id = auth.uid()),
    (select paroquia_id from servidor_profiles   where id = auth.uid())
  );
$$;

-- Cada usuário lê apenas a paróquia à qual pertence.
drop policy if exists "Usuario ve a propria paroquia" on paroquias;
create policy "Usuario ve a propria paroquia"
  on paroquias for select
  using (id = zd_paroquia_atual());

-- ── 4. BACKFILL: joga todos os dados atuais numa primeira paróquia ───────
-- AJUSTE o nome/cidade abaixo antes de rodar.
do $$
declare
  pid uuid;
begin
  select id into pid from paroquias limit 1;
  if pid is null then
    insert into paroquias (nome, cidade) values ('Santuário São José de Osvaldo Cruz', 'Osvaldo Cruz') returning id into pid;
  end if;

  update coordenador_profiles set paroquia_id = pid where paroquia_id is null;
  update servidor_profiles    set paroquia_id = pid where paroquia_id is null;
end $$;

-- Novos perfis criados pelo coordenador herdam a paróquia dele automaticamente.
alter table servidor_profiles   alter column paroquia_id set default zd_paroquia_atual();
alter table coordenador_profiles alter column paroquia_id set default zd_paroquia_atual();

-- ── 5. Coluna paroquia_id + DEFAULT + backfill em cada tabela de dados ───
do $$
declare
  t text;
  pid uuid;
  tabelas text[] := array[
    'servers', 'communities', 'server_sacraments', 'server_investitures',
    'formacao', 'atas_reuniao',
    'livro_caixa_centros_custo', 'livro_caixa_lancamentos',
    'mensagens'
  ];
begin
  select id into pid from paroquias limit 1;
  foreach t in array tabelas loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table %I add column if not exists paroquia_id uuid references paroquias(id)', t);
      execute format('update %I set paroquia_id = %L where paroquia_id is null', t, pid);
      execute format('alter table %I alter column paroquia_id set default zd_paroquia_atual()', t);
      execute format('alter table %I alter column paroquia_id set not null', t);
    end if;
  end loop;
end $$;

-- ── 6. RLS: recriar políticas exigindo a mesma paróquia ─────────────────
-- Remove QUALQUER política pré-existente das tabelas abaixo (torna o script
-- re-executável mesmo se uma execução anterior parou no meio).
do $$
declare
  r record;
  alvos text[] := array[
    'servidor_profiles','formacao','atas_reuniao',
    'livro_caixa_centros_custo','livro_caixa_lancamentos','mensagens',
    'servers','communities','server_sacraments','server_investitures'
  ];
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename = any(alvos)
  loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- servidor_profiles
create policy "Servidor ve a si mesmo ou coordenador ve os da paroquia"
  on servidor_profiles for select
  using (
    auth.uid() = id
    or exists (
      select 1 from coordenador_profiles c
      where c.id = auth.uid() and c.paroquia_id = servidor_profiles.paroquia_id
    )
  );
create policy "Coordenador gerencia servidores da propria paroquia"
  on servidor_profiles for all
  using (exists (select 1 from coordenador_profiles c where c.id = auth.uid() and c.paroquia_id = servidor_profiles.paroquia_id))
  with check (exists (select 1 from coordenador_profiles c where c.id = auth.uid() and c.paroquia_id = servidor_profiles.paroquia_id));

-- coordenador_profiles (mantém: cada coordenador só vê a si mesmo)
-- nada a mudar aqui.

-- formacao — antes "todos leem"; agora só a própria paróquia
drop policy if exists "Todos podem ler formação" on formacao;
drop policy if exists "Coordenadores podem criar/editar/deletar formação" on formacao;
create policy "Le formacao da propria paroquia"
  on formacao for select
  using (paroquia_id = zd_paroquia_atual());
create policy "Coordenador gerencia formacao da propria paroquia"
  on formacao for all
  using (exists (select 1 from coordenador_profiles where id = auth.uid()) and paroquia_id = zd_paroquia_atual())
  with check (exists (select 1 from coordenador_profiles where id = auth.uid()) and paroquia_id = zd_paroquia_atual());

-- atas_reuniao
drop policy if exists "Todos podem ler atas de reuniao" on atas_reuniao;
drop policy if exists "Coordenadores podem criar/editar/deletar atas de reuniao" on atas_reuniao;
create policy "Le atas da propria paroquia"
  on atas_reuniao for select
  using (paroquia_id = zd_paroquia_atual());
create policy "Coordenador gerencia atas da propria paroquia"
  on atas_reuniao for all
  using (exists (select 1 from coordenador_profiles where id = auth.uid()) and paroquia_id = zd_paroquia_atual())
  with check (exists (select 1 from coordenador_profiles where id = auth.uid()) and paroquia_id = zd_paroquia_atual());

-- livro_caixa
drop policy if exists "Coordenadores podem gerenciar centros de custo" on livro_caixa_centros_custo;
drop policy if exists "Coordenadores podem gerenciar lancamentos do livro caixa" on livro_caixa_lancamentos;
create policy "Coordenador gerencia centros de custo da paroquia"
  on livro_caixa_centros_custo for all
  using (exists (select 1 from coordenador_profiles where id = auth.uid()) and paroquia_id = zd_paroquia_atual())
  with check (exists (select 1 from coordenador_profiles where id = auth.uid()) and paroquia_id = zd_paroquia_atual());
create policy "Coordenador gerencia lancamentos da paroquia"
  on livro_caixa_lancamentos for all
  using (exists (select 1 from coordenador_profiles where id = auth.uid()) and paroquia_id = zd_paroquia_atual())
  with check (exists (select 1 from coordenador_profiles where id = auth.uid()) and paroquia_id = zd_paroquia_atual());

-- mensagens
drop policy if exists "Coordenadores enviam e veem todas as mensagens" on mensagens;
drop policy if exists "Servidores veem suas proprias mensagens" on mensagens;
drop policy if exists "Servidores marcam como lida suas mensagens" on mensagens;
create policy "Coordenador gerencia mensagens da paroquia"
  on mensagens for all
  using (exists (select 1 from coordenador_profiles c where c.id = auth.uid() and c.paroquia_id = mensagens.paroquia_id))
  with check (exists (select 1 from coordenador_profiles c where c.id = auth.uid() and c.paroquia_id = mensagens.paroquia_id));
create policy "Servidor ve suas mensagens na paroquia"
  on mensagens for select
  using (
    paroquia_id = zd_paroquia_atual()
    and destinatario_cadastro = (select numero_cadastro from servidor_profiles where id = auth.uid())
  );
create policy "Servidor marca como lida suas mensagens"
  on mensagens for update
  using (
    paroquia_id = zd_paroquia_atual()
    and destinatario_cadastro = (select numero_cadastro from servidor_profiles where id = auth.uid())
  )
  with check (
    paroquia_id = zd_paroquia_atual()
    and destinatario_cadastro = (select numero_cadastro from servidor_profiles where id = auth.uid())
  );

-- servers / communities / server_sacraments / server_investitures
-- Padrão: qualquer usuário logado da paróquia LÊ; só coordenador ESCREVE.
do $$
declare
  t text;
  tabelas text[] := array['servers','communities','server_sacraments','server_investitures'];
begin
  foreach t in array tabelas loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table %I enable row level security', t);
    -- remove políticas antigas dessa tabela
    execute coalesce((
      select string_agg(format('drop policy if exists %I on %I;', policyname, t), ' ')
      from pg_policies where schemaname = 'public' and tablename = t
    ), 'select 1');
    execute format($f$
      create policy "Le %1$s da propria paroquia" on %1$I for select
        using (paroquia_id = zd_paroquia_atual());
      create policy "Coordenador gerencia %1$s da propria paroquia" on %1$I for all
        using (exists (select 1 from coordenador_profiles where id = auth.uid()) and paroquia_id = zd_paroquia_atual())
        with check (exists (select 1 from coordenador_profiles where id = auth.uid()) and paroquia_id = zd_paroquia_atual());
    $f$, t);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PARA CRIAR UMA NOVA PARÓQUIA depois:
--
--   insert into paroquias (nome, cidade) values ('Paróquia São José', 'Cidade') returning id;
--
-- 1) Crie o coordenador em Authentication → Users (com senha).
-- 2) Vincule o perfil já com a paróquia:
--   insert into coordenador_profiles (id, email, full_name, numero_cadastro, paroquia_id)
--   values ((select id from auth.users where email='coord@paroquia.com'),
--           'coord@paroquia.com', 'Nome do Coordenador', '001', '<id-da-paroquia>');
--
-- A partir daí, tudo que esse coordenador cadastrar já entra na paróquia dele.
-- ═══════════════════════════════════════════════════════════════════════════
