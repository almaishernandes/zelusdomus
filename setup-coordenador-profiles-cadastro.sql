-- Permite localizar/atualizar coordenadores pelo numero de cadastro,
-- mesmo padrao ja usado em servidor_profiles
-- Rodar no Supabase SQL Editor

alter table coordenador_profiles add column if not exists numero_cadastro text;
create index if not exists idx_coordenador_profiles_numero on coordenador_profiles(numero_cadastro);
