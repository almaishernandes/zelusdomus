-- ═══════════════════════════════════════════════════════════════════════════
-- ZelusDomus — Perfil de SUPORTE (acesso a todas as paróquias)
-- Rodar UMA VEZ no Supabase SQL Editor, DEPOIS de setup-multiparoquia.sql.
--
-- Um coordenador marcado como suporte tem uma "paróquia ativa" que ele troca
-- livremente pelo seletor no cabeçalho do app. zd_paroquia_atual() passa a
-- devolver essa paróquia ativa para ele — então TODO o RLS e os DEFAULT já
-- existentes continuam funcionando sem nenhuma outra mudança.
-- ═══════════════════════════════════════════════════════════════════════════

alter table coordenador_profiles add column if not exists is_suporte boolean not null default false;
alter table coordenador_profiles add column if not exists paroquia_ativa_id uuid references paroquias(id);

create or replace function zd_paroquia_atual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case when is_suporte then paroquia_ativa_id else paroquia_id end
       from coordenador_profiles where id = auth.uid()),
    (select paroquia_id from servidor_profiles where id = auth.uid())
  );
$$;

-- Suporte precisa listar TODAS as paróquias (para o seletor no cabeçalho),
-- não só a ativa.
drop policy if exists "Usuario ve a propria paroquia" on paroquias;
create policy "Usuario ve a propria paroquia"
  on paroquias for select
  using (
    id = zd_paroquia_atual()
    or exists (select 1 from coordenador_profiles where id = auth.uid() and is_suporte)
  );

-- As duas políticas abaixo comparavam paroquia_id direto do coordenador
-- (que fica nulo/irrelevante para suporte); trocam para usar zd_paroquia_atual().
drop policy if exists "Servidor ve a si mesmo ou coordenador ve os da paroquia" on servidor_profiles;
create policy "Servidor ve a si mesmo ou coordenador ve os da paroquia"
  on servidor_profiles for select
  using (
    auth.uid() = id
    or exists (select 1 from coordenador_profiles c where c.id = auth.uid())
       and paroquia_id = zd_paroquia_atual()
  );

drop policy if exists "Coordenador gerencia servidores da propria paroquia" on servidor_profiles;
create policy "Coordenador gerencia servidores da propria paroquia"
  on servidor_profiles for all
  using (exists (select 1 from coordenador_profiles where id = auth.uid()) and paroquia_id = zd_paroquia_atual())
  with check (exists (select 1 from coordenador_profiles where id = auth.uid()) and paroquia_id = zd_paroquia_atual());

drop policy if exists "Coordenador gerencia mensagens da paroquia" on mensagens;
create policy "Coordenador gerencia mensagens da paroquia"
  on mensagens for all
  using (exists (select 1 from coordenador_profiles where id = auth.uid()) and paroquia_id = zd_paroquia_atual())
  with check (exists (select 1 from coordenador_profiles where id = auth.uid()) and paroquia_id = zd_paroquia_atual());

-- ═══════════════════════════════════════════════════════════════════════════
-- Para tornar alguém suporte manualmente (o /admin também faz isso):
--
--   update coordenador_profiles
--   set is_suporte = true, paroquia_ativa_id = paroquia_id
--   where email = 'almaishernandes@gmail.com';
-- ═══════════════════════════════════════════════════════════════════════════
