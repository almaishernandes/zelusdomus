-- Adiciona o campo "Anotações das Decisões" na Ata de Reunião
-- Rodar no Supabase SQL Editor

alter table atas_reuniao add column if not exists anotacoes_decisoes text;
