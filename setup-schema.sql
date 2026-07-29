-- Tabela: Perfis de Servidores do Altar
create table if not exists servidor_profiles (
  id uuid primary key default auth.uid(),
  numero_cadastro text unique not null,
  full_name text not null,
  email text unique not null,
  perfil text default 'servidor',
  telefone text,
  endereco text,
  data_inscricao timestamp default now(),
  updated_at timestamp default now(),
  constraint fk_user foreign key (id) references auth.users(id) on delete cascade
);

-- Tabela: Perfis de Coordenadores
create table if not exists coordenador_profiles (
  id uuid primary key default auth.uid(),
  email text unique not null,
  full_name text not null,
  perfil text default 'coordenador',
  created_at timestamp default now(),
  updated_at timestamp default now(),
  constraint fk_user foreign key (id) references auth.users(id) on delete cascade
);

-- Tabela: Formação (Temas, Assuntos, Conteúdo)
create table if not exists formacao (
  id uuid primary key default gen_random_uuid(),
  tema text not null,
  assunto text not null,
  conteudo text not null,
  fonte text,
  ordem int default 0,
  created_by uuid not null,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  constraint fk_created_by foreign key (created_by) references auth.users(id) on delete cascade
);

-- Índices para performance
create index if not exists idx_servidor_profiles_numero on servidor_profiles(numero_cadastro);
create index if not exists idx_servidor_profiles_email on servidor_profiles(email);
create index if not exists idx_formacao_tema on formacao(tema);
create index if not exists idx_formacao_created_by on formacao(created_by);

-- Row Level Security (RLS) — servidor_profiles
alter table servidor_profiles enable row level security;

create policy "Servidores podem ver seus próprios dados"
  on servidor_profiles for select
  using (auth.uid() = id or exists (select 1 from coordenador_profiles where id = auth.uid()));

create policy "Coordenadores podem gerenciar todos os servidores"
  on servidor_profiles for all
  using (exists (select 1 from coordenador_profiles where id = auth.uid()))
  with check (exists (select 1 from coordenador_profiles where id = auth.uid()));

-- Row Level Security (RLS) — coordenador_profiles
alter table coordenador_profiles enable row level security;

create policy "Coordenadores podem ver seus próprios dados"
  on coordenador_profiles for select
  using (auth.uid() = id);

create policy "Coordenadores podem atualizar seus dados"
  on coordenador_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Row Level Security (RLS) — formacao
alter table formacao enable row level security;

create policy "Todos podem ler formação"
  on formacao for select
  using (true);

create policy "Coordenadores podem criar/editar/deletar formação"
  on formacao for all
  using (exists (select 1 from coordenador_profiles where id = auth.uid()))
  with check (exists (select 1 from coordenador_profiles where id = auth.uid()) and created_by = auth.uid());
