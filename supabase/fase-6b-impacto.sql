-- Fase 6B: impacto_programa(meta). Cuántos clientes cambian si el dueño
-- cambia la meta del programa.
-- NO EJECUTADO. Para revisar.
-- Requiere las fases 2A (numeros_excluidos), 3 (canjes), 4 (guardar_programa)
-- y 4C (profiles.activo). No depende de fase-6-anular.sql.
-- Todo va en UNA transacción: si cualquier paso falla, no se aplica nada.
-- Las pruebas van al final, DESPUÉS del commit, comentadas: se copian y se
-- corren un bloque a la vez. Todas terminan en rollback.
--
-- Qué hace:
--   impacto_programa(p_meta) es de SOLO LECTURA (stable, no escribe nada).
--   La app la llama antes de guardar_programa para avisarle al dueño qué
--   pasará con sus clientes. Devuelve:
--     {
--       "meta_actual": 10,   meta guardada hoy
--       "meta_nueva":  8,    la que se consulta
--       "clientes":    40,   clientes que cuentan (sin números del personal)
--       "ya_alcanzan": 3,    con la meta nueva ya tienen premio y con la
--                            actual no (puntos >= nueva y < actual).
--                            Solo puede ser > 0 si la meta BAJA.
--       "mas_lejos":   0     les faltarán más visitas que hoy: todos los que
--                            no tienen ya el premio con la meta nueva
--                            (puntos < nueva). Solo puede ser > 0 si la meta
--                            SUBE. Incluye a quien hoy ya tiene premio y con
--                            la meta nueva lo pierde.
--     }
--   "clientes" sirve para el aviso de premio nuevo: si es 0 (configuración
--   inicial, aún sin clientes) la app no muestra ningún aviso.
--
--   Solo el dueño de un negocio activo. El negocio sale de la sesión
--   (auth.uid() → profiles), nunca de un parámetro: un dueño no puede
--   consultar otro negocio. Solo devuelve conteos, nunca datos de clientes.
--
--   Los números del personal (numeros_excluidos) no cuentan: no ganan puntos
--   ni canjean premios (Fase 3, NUMERO_EXCLUIDO).
--   Los puntos son clientes.puntos_actuales (lo que el cliente ve en su
--   tarjeta). Los puntos no cambian al cambiar la meta: solo la distancia.
--
-- Errores que verá la app (en error.message):
--   'Acceso denegado'   sin sesión de dueño (mesero, cuenta desactivada, etc.)
--   'NEGOCIO_INACTIVO'  el negocio está desactivado
--   'META_INVALIDA'     meta nula o fuera de 1 a 100 (igual que guardar_programa)

begin;


-- ═══ 0. Comprobaciones previas ═══
do $$
declare
  v_funcion text;
begin
  foreach v_funcion in array array[
    'public.user_has_business_role(uuid, text[])',
    'public.guardar_programa(integer, text, integer, numeric, numeric)'
  ] loop
    if to_regprocedure(v_funcion) is null then
      raise exception 'Falta % (revisar qué fase no se ha aplicado).', v_funcion;
    end if;
  end loop;

  if to_regclass('public.numeros_excluidos') is null then
    raise exception 'Falta la tabla numeros_excluidos (Fase 2A).';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clientes' and column_name = 'puntos_actuales'
  ) then
    raise exception 'Falta clientes.puntos_actuales.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'activo'
  ) then
    raise exception 'Falta profiles.activo (Fase 4C).';
  end if;
end;
$$;


-- ═══ 1. impacto_programa(meta) ═══
create or replace function public.impacto_programa(p_meta integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio public.negocios%rowtype;
  v_actual integer;
  v_clientes bigint;
  v_ya_alcanzan bigint;
  v_mas_lejos bigint;
begin
  -- Solo el dueño, y solo de su negocio (sale de la sesión).
  select n.* into v_negocio
  from public.profiles p
  join public.negocios n on n.id = p.negocio_id
  where p.user_id = auth.uid() and p.role = 'owner';

  if v_negocio.id is null
     or not public.user_has_business_role(v_negocio.id, array['owner']) then
    raise exception 'Acceso denegado';
  end if;
  if v_negocio.activo is not true then
    raise exception 'NEGOCIO_INACTIVO';
  end if;

  if p_meta is null or p_meta not between 1 and 100 then
    raise exception 'META_INVALIDA';
  end if;

  v_actual := coalesce(v_negocio.meta_puntos, 10);

  select count(*),
         count(*) filter (where cl.puntos >= p_meta and cl.puntos < v_actual),
         count(*) filter (where p_meta > v_actual and cl.puntos < p_meta)
  into v_clientes, v_ya_alcanzan, v_mas_lejos
  from (
    select coalesce(c.puntos_actuales, 0) as puntos
    from public.clientes c
    where c.negocio_id = v_negocio.id
      and not exists (
        select 1 from public.numeros_excluidos e
        where e.negocio_id = c.negocio_id and e.telefono = c.telefono
      )
  ) cl;

  return jsonb_build_object(
    'meta_actual', v_actual,
    'meta_nueva', p_meta,
    'clientes', v_clientes,
    'ya_alcanzan', v_ya_alcanzan,
    'mas_lejos', v_mas_lejos
  );
end;
$$;

revoke all on function public.impacto_programa(integer) from public, anon, authenticated;
grant execute on function public.impacto_programa(integer) to authenticated;


-- ═══ 2. Comprobaciones finales ═══
do $$
begin
  if not exists (
    select 1 from pg_proc
    where oid = to_regprocedure('public.impacto_programa(integer)')
      and prosecdef
      and 'search_path=""' = any (proconfig)
  ) then
    raise exception 'impacto_programa debe ser security definer con search_path vacío.';
  end if;

  -- Solo lectura: stable (una función volatile podría escribir).
  if (select provolatile from pg_proc where oid = to_regprocedure('public.impacto_programa(integer)')) <> 's' then
    raise exception 'impacto_programa debe ser stable (solo lectura).';
  end if;

  if has_function_privilege('anon', 'public.impacto_programa(integer)', 'execute') then
    raise exception 'anon NO debe poder ejecutar impacto_programa.';
  end if;
  if not has_function_privilege('authenticated', 'public.impacto_programa(integer)', 'execute') then
    raise exception 'authenticated debe poder ejecutar impacto_programa.';
  end if;
end;
$$;


commit;


-- ═══════════════════════════════════════════════════════════════════════
-- PRUEBAS (después de aplicar; un bloque a la vez; terminan en rollback)
-- ═══════════════════════════════════════════════════════════════════════
-- Usan un NEGOCIO DE PRUEBA (meta 5): "prestan" al primer dueño real moviendo
-- su perfil a ese negocio solo dentro de la prueba (el rollback lo regresa).
-- Teléfonos +5299800008xx.
-- Cada bloque termina con un NOTICE "OK ..." o con ERROR "FALLÓ ...".
/*

-- ═══ PRUEBA 1: conteos al bajar, subir y dejar igual la meta ═══
-- Datos (meta actual 5):
--   Ana 2, Beto 3, Carla 4, Dani 5, Eva 7, Fer 0 puntos.
--   Personal (número excluido) con 4 puntos: no cuenta.
--   Otro negocio con un cliente de 4 puntos: no cuenta.
-- Esperado: NOTICE "OK: impacto_programa pasó las 8 comprobaciones".
begin;
with n as (
  insert into public.negocios (nombre, email, meta_puntos, premio)
  values ('Prueba Fase 6B', 'prueba-fase-6b-impacto@example.invalid', 5, 'Un café')
  returning id
)
select set_config('prueba.negocio', id::text, true) from n;
with n as (
  insert into public.negocios (nombre, email, meta_puntos, premio)
  values ('Prueba Fase 6B ajeno', 'prueba-fase-6b-ajeno@example.invalid', 5, 'Un café')
  returning id
)
select set_config('prueba.ajeno', id::text, true) from n;

select set_config('prueba.dueno', p.user_id::text, true)
from public.profiles p join public.negocios ne on ne.id = p.negocio_id
where p.role = 'owner' and p.activo and ne.activo is true order by p.created_at limit 1;
update public.profiles set negocio_id = current_setting('prueba.negocio')::uuid
where user_id = current_setting('prueba.dueno')::uuid;

insert into public.clientes (negocio_id, telefono, nombre, puntos_actuales, total_visitas)
values (current_setting('prueba.negocio')::uuid, '+529980000801', 'Ana',      2, 2),
       (current_setting('prueba.negocio')::uuid, '+529980000802', 'Beto',     3, 3),
       (current_setting('prueba.negocio')::uuid, '+529980000803', 'Carla',    4, 4),
       (current_setting('prueba.negocio')::uuid, '+529980000804', 'Dani',     5, 5),
       (current_setting('prueba.negocio')::uuid, '+529980000805', 'Eva',      7, 7),
       (current_setting('prueba.negocio')::uuid, '+529980000806', 'Fer',      0, 5),
       (current_setting('prueba.negocio')::uuid, '+529980000807', 'Personal', 4, 4),
       (current_setting('prueba.ajeno')::uuid,   '+529980000899', 'Zoe',      4, 4);
insert into public.numeros_excluidos (negocio_id, telefono)
values (current_setting('prueba.negocio')::uuid, '+529980000807');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);

do $$
declare
  r jsonb;
  v_err text;
begin
  -- 1. Baja a 3: Beto (3) y Carla (4) ya alcanzan; Dani y Eva ya lo tenían.
  r := public.impacto_programa(3);
  if r->>'meta_actual' <> '5' or r->>'meta_nueva' <> '3' or r->>'clientes' <> '6' then
    raise exception 'FALLÓ 1: meta o clientes mal: %', r;
  end if;
  if r->>'ya_alcanzan' <> '2' or r->>'mas_lejos' <> '0' then
    raise exception 'FALLÓ 1: al bajar a 3 esperaba 2 y 0: %', r;
  end if;

  -- 2. Sube a 6: Ana, Beto, Carla, Dani (pierde el premio) y Fer quedan más lejos.
  r := public.impacto_programa(6);
  if r->>'ya_alcanzan' <> '0' or r->>'mas_lejos' <> '5' then
    raise exception 'FALLÓ 2: al subir a 6 esperaba 0 y 5: %', r;
  end if;

  -- 3. Igual: nadie cambia.
  r := public.impacto_programa(5);
  if r->>'ya_alcanzan' <> '0' or r->>'mas_lejos' <> '0' then
    raise exception 'FALLÓ 3: con la misma meta esperaba 0 y 0: %', r;
  end if;

  -- 4. Baja a 1: todos menos Fer (0) ya tienen; Dani y Eva ya lo tenían → 3.
  r := public.impacto_programa(1);
  if r->>'ya_alcanzan' <> '3' then
    raise exception 'FALLÓ 4: al bajar a 1 esperaba 3: %', r;
  end if;

  -- 5, 6, 7. Metas inválidas.
  v_err := null;
  begin perform public.impacto_programa(0); exception when others then v_err := sqlerrm; end;
  if v_err is distinct from 'META_INVALIDA' then raise exception 'FALLÓ 5: esperaba META_INVALIDA con 0, salió %', coalesce(v_err, '(sin error)'); end if;
  v_err := null;
  begin perform public.impacto_programa(101); exception when others then v_err := sqlerrm; end;
  if v_err is distinct from 'META_INVALIDA' then raise exception 'FALLÓ 6: esperaba META_INVALIDA con 101, salió %', coalesce(v_err, '(sin error)'); end if;
  v_err := null;
  begin perform public.impacto_programa(null); exception when others then v_err := sqlerrm; end;
  if v_err is distinct from 'META_INVALIDA' then raise exception 'FALLÓ 7: esperaba META_INVALIDA con null, salió %', coalesce(v_err, '(sin error)'); end if;

  -- 8. Solo lectura: la meta guardada no cambió.
  if (select n.meta_puntos from public.negocios n where n.id = current_setting('prueba.negocio')::uuid) <> 5 then
    raise exception 'FALLÓ 8: impacto_programa cambió la meta guardada';
  end if;

  raise notice 'OK: impacto_programa pasó las 8 comprobaciones';
end;
$$;
rollback;


-- ═══ PRUEBA 2: un negocio sin clientes (configuración inicial) ═══
-- Esperado: {"clientes": 0, "ya_alcanzan": 0, "mas_lejos": 0, ...}
begin;
with n as (
  insert into public.negocios (nombre, email, meta_puntos, premio)
  values ('Prueba Fase 6B vacío', 'prueba-fase-6b-vacio@example.invalid', 10, 'Un café gratis')
  returning id
)
select set_config('prueba.negocio', id::text, true) from n;
select set_config('prueba.dueno', p.user_id::text, true)
from public.profiles p join public.negocios ne on ne.id = p.negocio_id
where p.role = 'owner' and p.activo and ne.activo is true order by p.created_at limit 1;
update public.profiles set negocio_id = current_setting('prueba.negocio')::uuid
where user_id = current_setting('prueba.dueno')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select public.impacto_programa(5);
rollback;


-- ═══ PRUEBA 3: un mesero no puede consultar ═══
-- (Necesita un perfil con rol "mesero".)
-- Esperado: ERROR: Acceso denegado
begin;
select set_config('prueba.mesero', p.user_id::text, true)
from public.profiles p where p.role = 'mesero' and p.activo order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.mesero'), 'role', 'authenticated')::text, true);
select public.impacto_programa(5);
rollback;


-- ═══ PRUEBA 4: sin sesión no se puede consultar ═══
-- Esperado: ERROR: permission denied for function impacto_programa
begin;
set local role anon;
select public.impacto_programa(5);
rollback;


-- ═══ PRUEBA 5: negocio desactivado ═══
-- Esperado: ERROR: NEGOCIO_INACTIVO
begin;
select set_config('prueba.dueno', p.user_id::text, true),
       set_config('prueba.negocio', p.negocio_id::text, true)
from public.profiles p join public.negocios ne on ne.id = p.negocio_id
where p.role = 'owner' and p.activo and ne.activo is true order by p.created_at limit 1;
update public.negocios set activo = false where id = current_setting('prueba.negocio')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select public.impacto_programa(5);
rollback;

*/
