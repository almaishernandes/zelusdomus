-- Caixa de Mensagens: coordenadores enviam mensagens de texto para um ou mais
-- servidores (identificados pelo numero_cadastro, o mesmo usado em
-- servidor_profiles). Cada servidor só enxerga e só marca como lida as
-- mensagens endereçadas ao seu próprio cadastro.
-- Rodar no Supabase SQL Editor

create table if not exists mensagens (
  id uuid primary key default gen_random_uuid(),
  destinatario_cadastro text not null,
  remetente_id uuid references coordenador_profiles(id),
  texto text not null,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_mensagens_destinatario on mensagens(destinatario_cadastro);

alter table mensagens enable row level security;

drop policy if exists "Coordenadores enviam e veem todas as mensagens" on mensagens;
create policy "Coordenadores enviam e veem todas as mensagens"
  on mensagens for all
  using (exists (select 1 from coordenador_profiles where id = auth.uid()))
  with check (exists (select 1 from coordenador_profiles where id = auth.uid()));

drop policy if exists "Servidores veem suas proprias mensagens" on mensagens;
create policy "Servidores veem suas proprias mensagens"
  on mensagens for select
  using (destinatario_cadastro = (select numero_cadastro from servidor_profiles where id = auth.uid()));

drop policy if exists "Servidores marcam como lida suas mensagens" on mensagens;
create policy "Servidores marcam como lida suas mensagens"
  on mensagens for update
  using (destinatario_cadastro = (select numero_cadastro from servidor_profiles where id = auth.uid()))
  with check (destinatario_cadastro = (select numero_cadastro from servidor_profiles where id = auth.uid()));
