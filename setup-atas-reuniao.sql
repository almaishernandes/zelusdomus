-- Tabela: Atas de Reunião (Temas/Assuntos/Conteúdo) — independente da tabela "formacao"
create table if not exists atas_reuniao (
  id uuid primary key default gen_random_uuid(),
  tema text not null,
  assunto text not null,
  conteudo text not null,
  fonte text,
  ordem int default 0,
  created_by uuid not null,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  constraint fk_atas_created_by foreign key (created_by) references auth.users(id) on delete cascade
);

create index if not exists idx_atas_reuniao_tema on atas_reuniao(tema);
create index if not exists idx_atas_reuniao_created_by on atas_reuniao(created_by);

alter table atas_reuniao enable row level security;

create policy "Todos podem ler atas de reuniao"
  on atas_reuniao for select
  using (true);

create policy "Coordenadores podem criar/editar/deletar atas de reuniao"
  on atas_reuniao for all
  using (exists (select 1 from coordenador_profiles where id = auth.uid()))
  with check (exists (select 1 from coordenador_profiles where id = auth.uid()) and created_by = auth.uid());
