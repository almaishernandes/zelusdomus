-- Adiciona o e-mail de acesso ao cadastro de servidores (usado para criar o login automaticamente)
-- Rodar no Supabase SQL Editor

alter table servers add column if not exists email text;
