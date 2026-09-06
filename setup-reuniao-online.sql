-- ═══════════════════════════════════════════════════════════════════════════
-- ZelusDomus — Reunião da Equipe: tipo Presencial / Online + convites
-- Rodar UMA VEZ no Supabase SQL Editor, depois de setup-multiparoquia.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- Tipo e link da sala online na própria reunião
alter table atas_reuniao add column if not exists tipo text not null default 'presencial';
alter table atas_reuniao add column if not exists link_reuniao text;

-- Convidados de cada reunião (só quem tem numero_cadastro no app)
create table if not exists reuniao_convidados (
  id uuid primary key default gen_random_uuid(),
  reuniao_id uuid not null references atas_reuniao(id) on delete cascade,
  convidado_cadastro text not null,
  status text not null default 'pendente',       -- pendente | aceito | recusado
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  paroquia_id uuid not null default zd_paroquia_atual() references paroquias(id),
  unique (reuniao_id, convidado_cadastro)
);
create index if not exists idx_reuniao_convidados_reuniao  on reuniao_convidados(reuniao_id);
create index if not exists idx_reuniao_convidados_cadastro on reuniao_convidados(convidado_cadastro);

alter table reuniao_convidados enable row level security;

drop policy if exists "Coordenador gerencia convidados da paroquia" on reuniao_convidados;
create policy "Coordenador gerencia convidados da paroquia"
  on reuniao_convidados for all
  using (exists (select 1 from coordenador_profiles where id = auth.uid()) and paroquia_id = zd_paroquia_atual())
  with check (exists (select 1 from coordenador_profiles where id = auth.uid()) and paroquia_id = zd_paroquia_atual());

drop policy if exists "Convidado ve seus convites" on reuniao_convidados;
create policy "Convidado ve seus convites"
  on reuniao_convidados for select
  using (convidado_cadastro = (select numero_cadastro from servidor_profiles where id = auth.uid()));

drop policy if exists "Convidado responde seu convite" on reuniao_convidados;
create policy "Convidado responde seu convite"
  on reuniao_convidados for update
  using (convidado_cadastro = (select numero_cadastro from servidor_profiles where id = auth.uid()))
  with check (convidado_cadastro = (select numero_cadastro from servidor_profiles where id = auth.uid()));

-- Reuniões em que o usuário logado foi convidado. O link da sala só sai
-- depois que ele aceita — o resto (data, assunto, ordem do dia) sempre aparece.
create or replace function minhas_reunioes()
returns table (
  id uuid, tema text, assunto text, local text, data_reuniao text, horario text,
  tipo text, link_reuniao text, conteudo text, fonte text,
  convite_id uuid, status text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.tema, r.assunto, r.local, r.data_reuniao, r.horario,
         r.tipo,
         case when c.status = 'aceito' then r.link_reuniao else null end,
         r.conteudo, r.fonte,
         c.id, c.status
  from reuniao_convidados c
  join atas_reuniao r on r.id = c.reuniao_id
  where c.convidado_cadastro = (select numero_cadastro from servidor_profiles where id = auth.uid())
  order by r.data_reuniao nulls last, r.horario nulls last;
$$;
