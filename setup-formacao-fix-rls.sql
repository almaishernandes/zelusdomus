-- Mesma correcao aplicada em atas_reuniao: a tabela "formacao" (usada em
-- Formacao Cadastro) tambem so deixava quem criou um tema edita-lo/exclui-lo
-- (created_by = auth.uid()), bloqueando silenciosamente outros coordenadores.
-- Rodar no Supabase SQL Editor

drop policy if exists "Coordenadores podem criar/editar/deletar formação" on formacao;

create policy "Coordenadores podem criar/editar/deletar formação"
  on formacao for all
  using (exists (select 1 from coordenador_profiles where id = auth.uid()))
  with check (exists (select 1 from coordenador_profiles where id = auth.uid()));
