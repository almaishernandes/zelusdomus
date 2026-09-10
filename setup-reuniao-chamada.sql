-- ═══════════════════════════════════════════════════════════════════════════
-- ZelusDomus — "Chamar agora" para reunião online
-- Rodar depois de setup-reuniao-online.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- Marca o momento em que o coordenador tocou a chamada.
alter table atas_reuniao add column if not exists chamada_em timestamptz;

-- Realtime: o app dos convidados escuta UPDATE nesta tabela para tocar o alerta.
do $$
begin
  alter publication supabase_realtime add table atas_reuniao;
exception
  when duplicate_object then null;
end $$;

-- Aceita o convite e devolve o link da sala numa única chamada
-- (usado quando o convidado clica em "Entrar" na tela de chamada).
create or replace function entrar_na_reuniao(p_convite_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cadastro text;
  v_link text;
begin
  select numero_cadastro into v_cadastro from servidor_profiles where id = auth.uid();
  if v_cadastro is null then return null; end if;

  update reuniao_convidados
    set status = 'aceito', responded_at = now()
    where id = p_convite_id and convidado_cadastro = v_cadastro;

  select r.link_reuniao into v_link
    from reuniao_convidados c
    join atas_reuniao r on r.id = c.reuniao_id
    where c.id = p_convite_id and c.convidado_cadastro = v_cadastro;

  return v_link;
end $$;
