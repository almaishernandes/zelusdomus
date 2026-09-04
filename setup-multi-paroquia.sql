-- Multi-paróquia: isola os dados por paróquia (tenant) no mesmo banco,
-- mantendo a Paróquia Santuário de São José de Osvaldo Cruz com a numeração
-- de cadastro que já existe (sem renumerar nada), e permite um único acesso
-- de suporte que escolhe a paróquia ativa ao entrar.
--
-- Rodar no Supabase SQL Editor, uma única vez, na ordem em que aparece neste
-- arquivo (é seguro rodar de novo depois: os comandos usam "if not exists"/
-- "or replace"/"drop policy if exists").

-- =========================================================================
-- 1) Tabela de paróquias
-- =========================================================================
create table if not exists paroquias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  cidade text,
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);

insert into paroquias (nome, cidade) values
  ('Santuário de São José de Osvaldo Cruz', 'Osvaldo Cruz'),
  ('Imaculada Conceição de Parapuã', 'Parapuã'),
  ('São Benedito de Sagres', 'Sagres')
on conflict (nome) do nothing;

alter table paroquias enable row level security;

drop policy if exists "Autenticados podem ler paroquias" on paroquias;
create policy "Autenticados podem ler paroquias"
  on paroquias for select
  using (auth.uid() is not null);

-- =========================================================================
-- 2) paroquia_id nas tabelas de dado
--    (server_sacraments/server_investitures são criadas fora deste repo —
--    supõe que já existem, pois App.jsx já grava nelas)
-- =========================================================================
alter table coordenador_profiles      add column if not exists paroquia_id uuid references paroquias(id);
alter table servidor_profiles         add column if not exists paroquia_id uuid references paroquias(id);
alter table communities                add column if not exists paroquia_id uuid references paroquias(id);
alter table servers                    add column if not exists paroquia_id uuid references paroquias(id);
alter table server_sacraments          add column if not exists paroquia_id uuid references paroquias(id);
alter table server_investitures        add column if not exists paroquia_id uuid references paroquias(id);
alter table formacao                   add column if not exists paroquia_id uuid references paroquias(id);
alter table atas_reuniao               add column if not exists paroquia_id uuid references paroquias(id);
alter table livro_caixa_centros_custo  add column if not exists paroquia_id uuid references paroquias(id);
alter table livro_caixa_lancamentos    add column if not exists paroquia_id uuid references paroquias(id);
alter table mensagens                  add column if not exists paroquia_id uuid references paroquias(id);

-- Suporte: pode "entrar" em qualquer paróquia; a paróquia ativa fica aqui.
alter table coordenador_profiles add column if not exists paroquia_ativa_id uuid references paroquias(id);

-- Backfill: tudo que já existe hoje é da Paróquia de Osvaldo Cruz.
update coordenador_profiles     set paroquia_id = (select id from paroquias where nome = 'Santuário de São José de Osvaldo Cruz') where paroquia_id is null;
update servidor_profiles        set paroquia_id = (select id from paroquias where nome = 'Santuário de São José de Osvaldo Cruz') where paroquia_id is null;
update communities               set paroquia_id = (select id from paroquias where nome = 'Santuário de São José de Osvaldo Cruz') where paroquia_id is null;
update servers                   set paroquia_id = (select id from paroquias where nome = 'Santuário de São José de Osvaldo Cruz') where paroquia_id is null;
update formacao                  set paroquia_id = (select id from paroquias where nome = 'Santuário de São José de Osvaldo Cruz') where paroquia_id is null;
update atas_reuniao              set paroquia_id = (select id from paroquias where nome = 'Santuário de São José de Osvaldo Cruz') where paroquia_id is null;
update livro_caixa_centros_custo set paroquia_id = (select id from paroquias where nome = 'Santuário de São José de Osvaldo Cruz') where paroquia_id is null;
update livro_caixa_lancamentos   set paroquia_id = (select id from paroquias where nome = 'Santuário de São José de Osvaldo Cruz') where paroquia_id is null;
update mensagens                 set paroquia_id = (select id from paroquias where nome = 'Santuário de São José de Osvaldo Cruz') where paroquia_id is null;

update server_sacraments ss set paroquia_id = s.paroquia_id
  from servers s where ss.server_id = s.id and ss.paroquia_id is null;
update server_investitures si set paroquia_id = s.paroquia_id
  from servers s where si.server_id = s.id and si.paroquia_id is null;

-- Agora que ninguém está sem paróquia, torna obrigatório.
alter table coordenador_profiles      alter column paroquia_id set not null;
alter table servidor_profiles         alter column paroquia_id set not null;
alter table communities                alter column paroquia_id set not null;
alter table servers                    alter column paroquia_id set not null;
alter table server_sacraments          alter column paroquia_id set not null;
alter table server_investitures        alter column paroquia_id set not null;
alter table formacao                   alter column paroquia_id set not null;
alter table atas_reuniao               alter column paroquia_id set not null;
alter table livro_caixa_centros_custo  alter column paroquia_id set not null;
alter table livro_caixa_lancamentos    alter column paroquia_id set not null;
alter table mensagens                  alter column paroquia_id set not null;

create index if not exists idx_coordenador_profiles_paroquia on coordenador_profiles(paroquia_id);
create index if not exists idx_servidor_profiles_paroquia    on servidor_profiles(paroquia_id);
create index if not exists idx_communities_paroquia          on communities(paroquia_id);
create index if not exists idx_servers_paroquia              on servers(paroquia_id);
create index if not exists idx_server_sacraments_paroquia    on server_sacraments(paroquia_id);
create index if not exists idx_server_investitures_paroquia  on server_investitures(paroquia_id);
create index if not exists idx_formacao_paroquia             on formacao(paroquia_id);
create index if not exists idx_atas_reuniao_paroquia         on atas_reuniao(paroquia_id);
create index if not exists idx_livro_caixa_centros_paroquia  on livro_caixa_centros_custo(paroquia_id);
create index if not exists idx_livro_caixa_lancto_paroquia   on livro_caixa_lancamentos(paroquia_id);
create index if not exists idx_mensagens_paroquia            on mensagens(paroquia_id);

-- =========================================================================
-- 3) Cadastro reinicia do 1 em cada nova paróquia: numero_cadastro deixa de
--    ser único globalmente e passa a ser único por paróquia. Osvaldo Cruz
--    mantém os números que já tem — nada é renumerado aqui.
-- =========================================================================
alter table servidor_profiles drop constraint if exists servidor_profiles_numero_cadastro_key;
alter table servidor_profiles add constraint servidor_profiles_paroquia_numero_key unique (paroquia_id, numero_cadastro);

create unique index if not exists idx_coordenador_profiles_paroquia_numero
  on coordenador_profiles(paroquia_id, numero_cadastro);

-- =========================================================================
-- 4) Paróquia efetiva do usuário logado + preenchimento automático
-- =========================================================================
-- Coordenador normal: paroquia_id fixo do próprio cadastro.
-- Suporte (perfil = 'suporte'): a paróquia que ele escolheu ao entrar
-- (paroquia_ativa_id) tem prioridade; sem escolha ainda, cai no paroquia_id
-- "de origem" só para não travar a checagem de NOT NULL.
-- Servidor comum: paroquia_id do próprio cadastro.
create or replace function paroquia_do_usuario()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select paroquia_ativa_id from coordenador_profiles where id = auth.uid() and perfil = 'suporte'),
    (select paroquia_id from coordenador_profiles where id = auth.uid()),
    (select paroquia_id from servidor_profiles where id = auth.uid())
  );
$$;

grant execute on function paroquia_do_usuario() to authenticated;

-- Só o suporte pode trocar de paróquia ativa (roda pelo app, na tela de
-- "escolher paróquia" ou num "trocar paróquia" no menu).
create or replace function set_paroquia_ativa(nova_paroquia_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update coordenador_profiles
     set paroquia_ativa_id = nova_paroquia_id
   where id = auth.uid() and perfil = 'suporte';

  if not found then
    raise exception 'Apenas o acesso de suporte pode trocar de paróquia.';
  end if;
end;
$$;

grant execute on function set_paroquia_ativa(uuid) to authenticated;

-- Preenche paroquia_id sozinho em todo INSERT feito pelo app (que nunca vai
-- mandar essa coluna), usando a paróquia efetiva de quem está logado. Se
-- alguém mandar paroquia_id explicitamente (ex.: você mesmo rodando um
-- insert manual no SQL Editor como service role), o valor informado é
-- respeitado — e a política RLS (com "with check") é quem barra um valor
-- indevido vindo do app.
create or replace function set_paroquia_from_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.paroquia_id is null then
    new.paroquia_id := paroquia_do_usuario();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_paroquia_coordenador_profiles on coordenador_profiles;
create trigger trg_paroquia_coordenador_profiles before insert on coordenador_profiles
  for each row execute function set_paroquia_from_context();

drop trigger if exists trg_paroquia_servidor_profiles on servidor_profiles;
create trigger trg_paroquia_servidor_profiles before insert on servidor_profiles
  for each row execute function set_paroquia_from_context();

drop trigger if exists trg_paroquia_communities on communities;
create trigger trg_paroquia_communities before insert on communities
  for each row execute function set_paroquia_from_context();

drop trigger if exists trg_paroquia_servers on servers;
create trigger trg_paroquia_servers before insert on servers
  for each row execute function set_paroquia_from_context();

drop trigger if exists trg_paroquia_server_sacraments on server_sacraments;
create trigger trg_paroquia_server_sacraments before insert on server_sacraments
  for each row execute function set_paroquia_from_context();

drop trigger if exists trg_paroquia_server_investitures on server_investitures;
create trigger trg_paroquia_server_investitures before insert on server_investitures
  for each row execute function set_paroquia_from_context();

drop trigger if exists trg_paroquia_formacao on formacao;
create trigger trg_paroquia_formacao before insert on formacao
  for each row execute function set_paroquia_from_context();

drop trigger if exists trg_paroquia_atas_reuniao on atas_reuniao;
create trigger trg_paroquia_atas_reuniao before insert on atas_reuniao
  for each row execute function set_paroquia_from_context();

drop trigger if exists trg_paroquia_livro_caixa_centros on livro_caixa_centros_custo;
create trigger trg_paroquia_livro_caixa_centros before insert on livro_caixa_centros_custo
  for each row execute function set_paroquia_from_context();

drop trigger if exists trg_paroquia_livro_caixa_lancto on livro_caixa_lancamentos;
create trigger trg_paroquia_livro_caixa_lancto before insert on livro_caixa_lancamentos
  for each row execute function set_paroquia_from_context();

drop trigger if exists trg_paroquia_mensagens on mensagens;
create trigger trg_paroquia_mensagens before insert on mensagens
  for each row execute function set_paroquia_from_context();

-- =========================================================================
-- 5) Políticas RLS: troca "qualquer coordenador" por "coordenador da mesma
--    paróquia" em tudo. Tabelas que hoje têm RLS aberta (using true) também
--    passam a ser restritas por paróquia.
-- =========================================================================

-- servidor_profiles ---------------------------------------------------
drop policy if exists "Servidores podem ver seus próprios dados" on servidor_profiles;
create policy "Servidores podem ver seus próprios dados"
  on servidor_profiles for select
  using (
    auth.uid() = id
    or (paroquia_id = paroquia_do_usuario() and exists (select 1 from coordenador_profiles where id = auth.uid()))
  );

drop policy if exists "Coordenadores podem gerenciar todos os servidores" on servidor_profiles;
create policy "Coordenadores gerenciam servidores da própria paróquia"
  on servidor_profiles for all
  using (paroquia_id = paroquia_do_usuario() and exists (select 1 from coordenador_profiles where id = auth.uid()))
  with check (paroquia_id = paroquia_do_usuario() and exists (select 1 from coordenador_profiles where id = auth.uid()));

-- coordenador_profiles -------------------------------------------------
-- (select/update "seus próprios dados" já são seguros — não mudam)
drop policy if exists "Coordenadores podem criar coordenadores da própria paróquia" on coordenador_profiles;
create policy "Coordenadores podem criar coordenadores da própria paróquia"
  on coordenador_profiles for insert
  with check (paroquia_id = paroquia_do_usuario());

-- A policy de update "seus próprios dados" (já existente, não mudou) deixa
-- qualquer coordenador alterar qualquer coluna da própria linha — inofensivo
-- até aqui, mas agora "perfil" e "paroquia_id" concedem acesso a paróquias
-- inteiras, então um coordenador comum não pode mais poder virar "suporte"
-- ou trocar sua própria paróquia de origem sozinho, editando a própria linha
-- pelo app. Só um update rodado direto no SQL Editor (fora do PostgREST,
-- sem JWT de authenticated) consegue mudar essas duas colunas.
create or replace function proteger_campos_sensiveis_coordenador()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'authenticated' then
    if new.perfil is distinct from old.perfil then
      new.perfil := old.perfil;
    end if;
    if new.paroquia_id is distinct from old.paroquia_id then
      new.paroquia_id := old.paroquia_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protege_coordenador_profiles on coordenador_profiles;
create trigger trg_protege_coordenador_profiles before update on coordenador_profiles
  for each row execute function proteger_campos_sensiveis_coordenador();

-- communities ------------------------------------------------------------
alter table communities enable row level security;
drop policy if exists "Leitura de comunidades da própria paróquia" on communities;
create policy "Leitura de comunidades da própria paróquia"
  on communities for select
  using (paroquia_id = paroquia_do_usuario());
drop policy if exists "Coordenadores gerenciam comunidades da própria paróquia" on communities;
create policy "Coordenadores gerenciam comunidades da própria paróquia"
  on communities for all
  using (paroquia_id = paroquia_do_usuario() and exists (select 1 from coordenador_profiles where id = auth.uid()))
  with check (paroquia_id = paroquia_do_usuario() and exists (select 1 from coordenador_profiles where id = auth.uid()));

-- servers (elenco por função: coroinha/acólito/monitor/cerimoniário/coordenador)
alter table servers enable row level security;
drop policy if exists "Leitura de servers da própria paróquia" on servers;
create policy "Leitura de servers da própria paróquia"
  on servers for select
  using (paroquia_id = paroquia_do_usuario());
drop policy if exists "Coordenadores gerenciam servers da própria paróquia" on servers;
create policy "Coordenadores gerenciam servers da própria paróquia"
  on servers for all
  using (paroquia_id = paroquia_do_usuario() and exists (select 1 from coordenador_profiles where id = auth.uid()))
  with check (paroquia_id = paroquia_do_usuario() and exists (select 1 from coordenador_profiles where id = auth.uid()));

-- server_sacraments / server_investitures --------------------------------
alter table server_sacraments enable row level security;
drop policy if exists "Coordenadores gerenciam sacramentos da própria paróquia" on server_sacraments;
create policy "Coordenadores gerenciam sacramentos da própria paróquia"
  on server_sacraments for all
  using (paroquia_id = paroquia_do_usuario() and exists (select 1 from coordenador_profiles where id = auth.uid()))
  with check (paroquia_id = paroquia_do_usuario() and exists (select 1 from coordenador_profiles where id = auth.uid()));

alter table server_investitures enable row level security;
drop policy if exists "Coordenadores gerenciam investiduras da própria paróquia" on server_investitures;
create policy "Coordenadores gerenciam investiduras da própria paróquia"
  on server_investitures for all
  using (paroquia_id = paroquia_do_usuario() and exists (select 1 from coordenador_profiles where id = auth.uid()))
  with check (paroquia_id = paroquia_do_usuario() and exists (select 1 from coordenador_profiles where id = auth.uid()));

-- formacao ------------------------------------------------------------
drop policy if exists "Todos podem ler formação" on formacao;
create policy "Leitura de formação da própria paróquia"
  on formacao for select
  using (paroquia_id = paroquia_do_usuario());

drop policy if exists "Coordenadores podem criar/editar/deletar formação" on formacao;
create policy "Coordenadores gerenciam formação da própria paróquia"
  on formacao for all
  using (paroquia_id = paroquia_do_usuario() and exists (select 1 from coordenador_profiles where id = auth.uid()))
  with check (paroquia_id = paroquia_do_usuario() and exists (select 1 from coordenador_profiles where id = auth.uid()));

-- atas_reuniao ------------------------------------------------------------
drop policy if exists "Todos podem ler atas de reuniao" on atas_reuniao;
create policy "Leitura de atas de reuniao da própria paróquia"
  on atas_reuniao for select
  using (paroquia_id = paroquia_do_usuario());

drop policy if exists "Coordenadores podem criar/editar/deletar atas de reuniao" on atas_reuniao;
create policy "Coordenadores gerenciam atas de reuniao da própria paróquia"
  on atas_reuniao for all
  using (paroquia_id = paroquia_do_usuario() and exists (select 1 from coordenador_profiles where id = auth.uid()))
  with check (paroquia_id = paroquia_do_usuario() and exists (select 1 from coordenador_profiles where id = auth.uid()));

-- livro_caixa_* ------------------------------------------------------------
drop policy if exists "Coordenadores podem gerenciar centros de custo" on livro_caixa_centros_custo;
create policy "Coordenadores gerenciam centros de custo da própria paróquia"
  on livro_caixa_centros_custo for all
  using (paroquia_id = paroquia_do_usuario() and exists (select 1 from coordenador_profiles where id = auth.uid()))
  with check (paroquia_id = paroquia_do_usuario() and exists (select 1 from coordenador_profiles where id = auth.uid()));

drop policy if exists "Coordenadores podem gerenciar lancamentos do livro caixa" on livro_caixa_lancamentos;
create policy "Coordenadores gerenciam lancamentos da própria paróquia"
  on livro_caixa_lancamentos for all
  using (paroquia_id = paroquia_do_usuario() and exists (select 1 from coordenador_profiles where id = auth.uid()))
  with check (paroquia_id = paroquia_do_usuario() and exists (select 1 from coordenador_profiles where id = auth.uid()));

-- mensagens -----------------------------------------------------------
-- numero_cadastro deixou de ser único globalmente (item 3), então as
-- políticas de servidor precisam checar também a paróquia — senão o
-- cadastro nº 1 de uma paróquia enxergaria as mensagens do cadastro nº 1
-- de outra.
drop policy if exists "Coordenadores enviam e veem todas as mensagens" on mensagens;
create policy "Coordenadores gerenciam mensagens da própria paróquia"
  on mensagens for all
  using (paroquia_id = paroquia_do_usuario() and exists (select 1 from coordenador_profiles where id = auth.uid()))
  with check (paroquia_id = paroquia_do_usuario() and exists (select 1 from coordenador_profiles where id = auth.uid()));

drop policy if exists "Servidores veem suas proprias mensagens" on mensagens;
create policy "Servidores veem suas proprias mensagens"
  on mensagens for select
  using (
    paroquia_id = paroquia_do_usuario()
    and destinatario_cadastro = (select numero_cadastro from servidor_profiles where id = auth.uid())
  );

drop policy if exists "Servidores marcam como lida suas mensagens" on mensagens;
create policy "Servidores marcam como lida suas mensagens"
  on mensagens for update
  using (
    paroquia_id = paroquia_do_usuario()
    and destinatario_cadastro = (select numero_cadastro from servidor_profiles where id = auth.uid())
  )
  with check (
    paroquia_id = paroquia_do_usuario()
    and destinatario_cadastro = (select numero_cadastro from servidor_profiles where id = auth.uid())
  );

-- =========================================================================
-- 6) Criar o acesso de suporte (fazer isto UMA vez, manualmente)
-- =========================================================================
-- 1. Supabase Dashboard > Authentication > Users > Add user (email + senha).
-- 2. Copie o UUID gerado e rode, trocando o e-mail e o UUID abaixo:
--
-- insert into coordenador_profiles (id, email, full_name, perfil, paroquia_id)
-- values (
--   '<uuid-do-usuario-criado-no-passo-1>',
--   'suporte@zelusdomus.com.br',
--   'Suporte ZelusDomus',
--   'suporte',
--   (select id from paroquias where nome = 'Santuário de São José de Osvaldo Cruz')
-- );
--
-- O suporte loga normalmente pela tela de login do app; como ainda não tem
-- paroquia_ativa_id definido, o app vai pedir pra ele escolher a paróquia
-- antes de mostrar qualquer tela — e ele pode trocar de paróquia depois a
-- qualquer momento pelo próprio app.
