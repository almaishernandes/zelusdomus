-- Livro Caixa: centros de custo e lançamentos de débito/crédito
-- Rodar no Supabase SQL Editor

create table if not exists livro_caixa_centros_custo (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_by uuid references auth.users(id),
  created_at timestamp default now()
);

create table if not exists livro_caixa_lancamentos (
  id uuid primary key default gen_random_uuid(),
  sequencia serial,
  emissao date not null,
  vencimento date,
  descricao text not null,
  centro_custo_id uuid references livro_caixa_centros_custo(id),
  debito numeric default 0,
  credito numeric default 0,
  created_by uuid references auth.users(id),
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table livro_caixa_centros_custo enable row level security;
alter table livro_caixa_lancamentos enable row level security;

create policy "Coordenadores podem gerenciar centros de custo"
  on livro_caixa_centros_custo for all
  using (exists (select 1 from coordenador_profiles where id = auth.uid()))
  with check (exists (select 1 from coordenador_profiles where id = auth.uid()));

create policy "Coordenadores podem gerenciar lancamentos do livro caixa"
  on livro_caixa_lancamentos for all
  using (exists (select 1 from coordenador_profiles where id = auth.uid()))
  with check (exists (select 1 from coordenador_profiles where id = auth.uid()));
