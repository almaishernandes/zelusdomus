-- Corrige a politica de seguranca (RLS) das Atas de Reuniao: hoje so quem
-- criou a reuniao consegue editar/excluir (created_by = auth.uid()), o que
-- bloqueia silenciosamente a edicao por outros coordenadores.
-- Passa a permitir que QUALQUER coordenador crie/edite/exclua qualquer ata.
-- Rodar no Supabase SQL Editor

drop policy if exists "Coordenadores podem criar/editar/deletar atas de reuniao" on atas_reuniao;

create policy "Coordenadores podem criar/editar/deletar atas de reuniao"
  on atas_reuniao for all
  using (exists (select 1 from coordenador_profiles where id = auth.uid()))
  with check (exists (select 1 from coordenador_profiles where id = auth.uid()));
