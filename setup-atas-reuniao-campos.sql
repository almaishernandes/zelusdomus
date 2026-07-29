-- Adiciona campos de Local, Data e Horário à tabela de Atas de Reunião
alter table atas_reuniao add column if not exists local text;
alter table atas_reuniao add column if not exists data_reuniao text;
alter table atas_reuniao add column if not exists horario text;
