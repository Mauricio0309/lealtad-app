-- Fase 4D: gráfica sencilla en "Mi panel" del dueño.
-- NO EJECUTADO. Para revisar. Requiere la Fase 4 y la 4C (profiles.activo).
-- Todo va en UNA transacción: si cualquier paso falla, no se aplica nada.
-- Las pruebas van al final, DESPUÉS del commit, comentadas: se copian y se
-- corren un bloque a la vez. Todas terminan en rollback.
--
-- Qué hace:
--   1. grafica_dueno(periodo)  series YA AGREGADAS para la gráfica del panel.
--      Solo conteos: nunca filas de clientes, nombres ni teléfonos.
--   2. resumen_meseros()       la tabla "Tu equipo esta semana" ya no muestra
--      meseros desactivados (mismo cálculo que en la Fase 4, más p.activo).
--
-- Periodos (días en la zona horaria del negocio):
--   'semana'  los últimos 7 días contando hoy, día por día; se compara con
--             los 7 días anteriores (la misma regla de "esta semana" del
--             resumen, así la cifra y la gráfica nunca se contradicen).
--   'mes'     las últimas 4 semanas (28 días contando hoy), semana por semana;
--             se compara con las 4 semanas antes de esas.
--   Visita = fila de visitas con cliente (la misma regla de resumen_dueno).
--   Clientes acumulados = clientes registrados hasta el final de cada tramo
--   (por clientes.fecha_registro); siempre sube.
--
-- "Una semana de datos": si la primera visita del negocio fue hace menos de
-- 7 días (contando hoy), la función responde suficiente = false y no manda
-- series; la app muestra "Tu gráfica aparece cuando tengas una semana de visitas".
--
-- Errores (en error.message):
--   'Acceso denegado'   sin sesión o no es dueño (o está desactivado)
--   'NEGOCIO_INACTIVO'  el negocio está desactivado
--   'PERIODO_INVALIDO'  el periodo no es 'semana' ni 'mes'

begin;


-- ═══ 0. Comprobaciones previas ═══
do $$
begin
  if to_regprocedure('public.resumen_meseros()') is null
     or to_regprocedure('public.resumen_dueno()') is null then
    raise exception 'Falta la Fase 4 (resumen_dueno y resumen_meseros).';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'activo'
  ) then
    raise exception 'Falta profiles.activo (Fase 4C).';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'visitas' and column_name = 'dia_local'
  ) then
    raise exception 'Falta visitas.dia_local (fase 2A).';
  end if;
  -- fecha_registro es "timestamp sin zona" guardado en UTC (default now() con
  -- la base en UTC). Si algún día cambia de tipo, hay que revisar la conversión.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clientes'
      and column_name = 'fecha_registro' and data_type = 'timestamp without time zone'
  ) then
    raise exception 'clientes.fecha_registro cambió de tipo: revisar la conversión a hora local antes de aplicar.';
  end if;
  if current_setting('TimeZone') not in ('UTC', 'Etc/UTC') then
    raise exception 'La base no está en UTC (%): revisar cómo se guardó clientes.fecha_registro.', current_setting('TimeZone');
  end if;
end;
$$;


-- ═══ 1. grafica_dueno(periodo) ═══
-- Respuesta (suficiente = true):
--   {
--     "periodo": "semana", "suficiente": true, "dias_de_datos": 40,
--     "hoy": "2026-11-04",
--     "puntos": [
--       {"i": 0, "dia": "2026-10-29", "actual": 12, "anterior": 9, "clientes": 140}, ...
--     ],
--     "total": 61, "total_anterior": 70, "bajaron": true,
--     "clientes_inicio": 132
--   }
--   En 'mes', "dia" es el primer día de cada semana (la última termina hoy).
--   "anterior" = el mismo tramo del periodo anterior.
--   "clientes" = registrados hasta el final de ese tramo.
--   "clientes_inicio" = registrados antes del primer tramo.
create or replace function public.grafica_dueno(p_periodo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio public.negocios%rowtype;
  v_tz text;
  v_hoy date;
  v_primer_dia date;
  v_dias integer;
  v_n integer;         -- cuántos tramos
  v_largo integer;     -- días por tramo
  v_base date;         -- primer día del primer tramo
  v_desplazo integer;  -- días que se recorre para el periodo anterior
  v_puntos jsonb;
  v_total bigint;
  v_total_ant bigint;
  v_clientes_inicio bigint;
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
  if p_periodo is null or p_periodo not in ('semana', 'mes') then
    raise exception 'PERIODO_INVALIDO';
  end if;

  v_tz := v_negocio.zona_horaria;
  v_hoy := (now() at time zone v_tz)::date;

  -- ¿Ya hay una semana de visitas?
  select min(v.dia_local) into v_primer_dia
  from public.visitas v
  where v.negocio_id = v_negocio.id
    and v.cliente_id is not null;

  v_dias := case when v_primer_dia is null then 0 else v_hoy - v_primer_dia + 1 end;

  if v_dias < 7 then
    return jsonb_build_object(
      'periodo', p_periodo,
      'suficiente', false,
      'dias_de_datos', v_dias,
      'hoy', v_hoy
    );
  end if;

  if p_periodo = 'semana' then
    v_n := 7; v_largo := 1;
  else
    v_n := 4; v_largo := 7;
  end if;
  v_desplazo := v_n * v_largo;              -- 7 o 28 días
  v_base := v_hoy - (v_desplazo - 1);       -- hoy - 6 o hoy - 27

  with tramos as (
    select g as i,
           v_base + g * v_largo as ini,          -- primer día (incluido)
           v_base + (g + 1) * v_largo as fin     -- día siguiente al último
    from generate_series(0, v_n - 1) as g
  ),
  -- Visitas del periodo actual y del anterior. Usa el índice (negocio_id, dia_local).
  vis as (
    select v.dia_local as dia
    from public.visitas v
    where v.negocio_id = v_negocio.id
      and v.cliente_id is not null
      and v.dia_local between v_base - v_desplazo and v_hoy
  ),
  -- Día de registro de cada cliente, en la zona del negocio.
  cli as (
    select ((cl.fecha_registro at time zone 'UTC') at time zone v_tz)::date as dia
    from public.clientes cl
    where cl.negocio_id = v_negocio.id
  ),
  filas as (
    select t.i,
           t.ini,
           (select count(*) from vis where vis.dia >= t.ini and vis.dia < t.fin) as actual,
           (select count(*) from vis where vis.dia >= t.ini - v_desplazo and vis.dia < t.fin - v_desplazo) as anterior,
           -- Sin fecha de registro = cliente de antes: cuenta desde siempre.
           (select count(*) from cli where cli.dia is null or cli.dia < t.fin) as clientes
    from tramos t
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'i', f.i,
           'dia', f.ini,
           'actual', f.actual,
           'anterior', f.anterior,
           'clientes', f.clientes
         ) order by f.i), '[]'::jsonb),
         coalesce(sum(f.actual), 0),
         coalesce(sum(f.anterior), 0)
  into v_puntos, v_total, v_total_ant
  from filas f;

  -- Clientes que ya había antes del primer tramo (para "+N nuevos").
  select count(*) into v_clientes_inicio
  from public.clientes cl
  where cl.negocio_id = v_negocio.id
    and (cl.fecha_registro is null
         or ((cl.fecha_registro at time zone 'UTC') at time zone v_tz)::date < v_base);

  return jsonb_build_object(
    'periodo', p_periodo,
    'suficiente', true,
    'dias_de_datos', v_dias,
    'hoy', v_hoy,
    'puntos', v_puntos,
    'total', v_total,
    'total_anterior', v_total_ant,
    'bajaron', v_total < v_total_ant,
    'clientes_inicio', v_clientes_inicio
  );
end;
$$;

revoke all on function public.grafica_dueno(text) from public, anon, authenticated;
grant execute on function public.grafica_dueno(text) to authenticated;


-- ═══ 2. resumen_meseros() sin meseros desactivados ═══
-- Idéntica a la de la Fase 4, con un solo cambio: el equipo solo incluye
-- perfiles activos (and p.activo). Los desactivados siguen en la pestaña
-- "Equipo" (equipo_negocio) y sus visitas siguen contando en el resumen.
create or replace function public.resumen_meseros()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio public.negocios%rowtype;
  v_hoy date;
  v_desde date;
  v_inicio timestamptz;  -- medianoche del primer día de la semana, hora del negocio
  v_lista jsonb;
begin
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

  v_hoy := (now() at time zone v_negocio.zona_horaria)::date;
  v_desde := v_hoy - 6;
  v_inicio := v_desde::timestamp at time zone v_negocio.zona_horaria;

  with equipo as (
    select p.user_id, p.role, nullif(btrim(p.nombre), '') as nombre, p.created_at
    from public.profiles p
    where p.negocio_id = v_negocio.id
      and p.activo   -- 4D: los meseros desactivados ya no aparecen
  ),
  cods as (
    select c.creado_por as user_id,
           count(*) as generados,
           count(*) filter (where c.reclamado_en is not null) as reclamados
    from public.codigos c
    where c.negocio_id = v_negocio.id
      and c.creado_en >= v_inicio
    group by c.creado_por
  ),
  man as (
    select v.mesero_id as user_id, count(*) as manuales
    from public.visitas v
    where v.negocio_id = v_negocio.id
      and v.origen = 'manual'
      and v.dia_local between v_desde and v_hoy
    group by v.mesero_id
  ),
  filas as (
    select e.user_id,
           e.role,
           coalesce(e.nombre, case when e.role = 'owner' then 'Dueño' else 'Mesero' end) as nombre,
           e.created_at,
           coalesce(cods.generados, 0) as generados,
           coalesce(cods.reclamados, 0) as reclamados,
           coalesce(man.manuales, 0) as manuales,
           coalesce(i.bloqueos, 0) as bloqueos_canje,
           coalesce(i.bloqueado_hasta > now() - interval '7 days', false) as bloqueado_semana
    from equipo e
    left join cods on cods.user_id = e.user_id
    left join man on man.user_id = e.user_id
    left join public.canje_intentos i on i.usuario_id = e.user_id
  ),
  con_reglas as (
    select f.*,
           (f.generados >= 5 and f.reclamados * 2 < f.generados) as regla_a,
           (f.manuales >= 5 and f.manuales > f.reclamados) as regla_b,
           f.bloqueado_semana as regla_c
    from filas f
    where f.role = 'mesero' or f.generados > 0 or f.manuales > 0
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre', r.nombre,
           'rol', r.role,
           'generados', r.generados,
           'reclamados', r.reclamados,
           'manuales', r.manuales,
           'bloqueos_canje', r.bloqueos_canje,
           'revisar', r.regla_a or r.regla_b or r.regla_c,
           'motivo', nullif(concat_ws(' · ',
             case when r.regla_a then format('Muchos códigos sin usar (%s de %s)', r.reclamados, r.generados) end,
             case when r.regla_b then 'Más capturas a mano que códigos escaneados' end,
             case when r.regla_c then 'Escribió mal el código de canje muchas veces' end
           ), '')
         ) order by (r.regla_a or r.regla_b or r.regla_c) desc, r.generados desc, r.created_at), '[]'::jsonb)
  into v_lista
  from con_reglas r;

  return jsonb_build_object('meseros', v_lista);
end;
$$;

revoke all on function public.resumen_meseros() from public, anon, authenticated;
grant execute on function public.resumen_meseros() to authenticated;


-- ═══ 3. Comprobaciones finales ═══
do $$
declare
  v_funcion text;
begin
  foreach v_funcion in array array[
    'public.grafica_dueno(text)',
    'public.resumen_meseros()'
  ] loop
    if not exists (
      select 1 from pg_proc
      where oid = to_regprocedure(v_funcion)
        and prosecdef
        and 'search_path=""' = any (proconfig)
    ) then
      raise exception '% debe ser security definer con search_path vacío.', v_funcion;
    end if;
    if has_function_privilege('anon', v_funcion, 'execute') then
      raise exception 'anon NO debe poder ejecutar %.', v_funcion;
    end if;
    if not has_function_privilege('authenticated', v_funcion, 'execute') then
      raise exception 'authenticated debe poder ejecutar %.', v_funcion;
    end if;
  end loop;

  if position('p.activo' in (select prosrc from pg_proc where oid = to_regprocedure('public.resumen_meseros()'))) = 0 then
    raise exception 'resumen_meseros debe filtrar los perfiles desactivados.';
  end if;

  -- La gráfica no devuelve datos personales: su código no lee telefono ni nombre.
  if (select prosrc from pg_proc where oid = to_regprocedure('public.grafica_dueno(text)')) ~* '\m(telefono|nombre)\M' then
    raise exception 'grafica_dueno no debe leer teléfonos ni nombres.';
  end if;

  -- Las funciones de "Dejaron de venir" se quedan (la app solo las oculta).
  if to_regprocedure('public.clientes_inactivos()') is null then
    raise exception 'clientes_inactivos() debe seguir existiendo (vuelve con WhatsApp).';
  end if;
end;
$$;


commit;


-- ═══════════════════════════════════════════════════════════════════════
-- PRUEBAS (después de aplicar; un bloque a la vez; terminan en rollback)
-- ═══════════════════════════════════════════════════════════════════════
-- Las pruebas 1 y 2 usan un NEGOCIO DE PRUEBA vacío (como en la Fase 4):
-- "prestan" a un dueño real moviendo su perfil a ese negocio solo dentro de
-- la prueba (el rollback lo regresa).
/*

-- ═══ PRUEBA 1: menos de una semana de datos ═══
-- Una sola visita hace 3 días.
-- Esperado: {"periodo": "semana", "suficiente": false, "dias_de_datos": 4, "hoy": ...}
begin;
with n as (
  insert into public.negocios (nombre, email, meta_puntos, premio)
  values ('Prueba Fase 4D', 'prueba-fase-4d@example.invalid', 5, 'Un café')
  returning id
)
select set_config('prueba.negocio', id::text, true) from n;
select set_config('prueba.dueno', p.user_id::text, true)
from public.profiles p join public.negocios ne on ne.id = p.negocio_id
where p.role = 'owner' and ne.activo is true order by p.created_at limit 1;
update public.profiles set negocio_id = current_setting('prueba.negocio')::uuid
where user_id = current_setting('prueba.dueno')::uuid;
with c as (
  insert into public.clientes (negocio_id, telefono, nombre, puntos_actuales, total_visitas)
  values (current_setting('prueba.negocio')::uuid, '+529980000601', 'Ana', 1, 1)
  returning id
)
insert into public.visitas (cliente_id, negocio_id, fecha, origen)
select c.id, current_setting('prueba.negocio')::uuid, now() - interval '3 days', 'qr' from c;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select public.grafica_dueno('semana');
rollback;


-- ═══ PRUEBA 2: semana y mes con datos, sin datos personales ═══
-- Ana (registrada hace 31 días): visitas hace 30, 9, 8 y 1 días.
-- Luis (registrado hace 2 días): visita hoy.
-- Esperado semana: suficiente true, 7 puntos, total 2 (ayer y hoy),
--   total_anterior 2 (hace 9 y 8), bajaron false, clientes_inicio 1;
--   "clientes" del primer punto 1 y del último 2.
-- Esperado mes: 4 puntos, total 4 (hace 9, 8, 1 y hoy), total_anterior 1
--   (hace 30), bajaron false.
-- tiene_datos_personales: false en las dos.
-- (Cerca de medianoche los días pueden recorrerse uno.)
begin;
with n as (
  insert into public.negocios (nombre, email, meta_puntos, premio)
  values ('Prueba Fase 4D', 'prueba-fase-4d@example.invalid', 5, 'Un café')
  returning id
)
select set_config('prueba.negocio', id::text, true) from n;
select set_config('prueba.dueno', p.user_id::text, true)
from public.profiles p join public.negocios ne on ne.id = p.negocio_id
where p.role = 'owner' and ne.activo is true order by p.created_at limit 1;
update public.profiles set negocio_id = current_setting('prueba.negocio')::uuid
where user_id = current_setting('prueba.dueno')::uuid;
with c as (
  insert into public.clientes (negocio_id, telefono, nombre, puntos_actuales, total_visitas, fecha_registro)
  values (current_setting('prueba.negocio')::uuid, '+529980000601', 'Ana', 4, 4, (now() - interval '31 days') at time zone 'UTC'),
         (current_setting('prueba.negocio')::uuid, '+529980000602', 'Luis', 1, 1, (now() - interval '2 days') at time zone 'UTC')
  returning id, nombre
)
insert into public.visitas (cliente_id, negocio_id, fecha, origen)
select c.id, current_setting('prueba.negocio')::uuid, now() - x.dias * interval '1 day', 'qr'
from c join (values ('Ana', 30), ('Ana', 9), ('Ana', 8), ('Ana', 1), ('Luis', 0)) as x(nombre, dias)
  on x.nombre = c.nombre;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select s.semana, s.mes,
       (s.semana::text || s.mes::text) ~ '\+52|998000060|Ana|Luis' as tiene_datos_personales
from (select public.grafica_dueno('semana') as semana, public.grafica_dueno('mes') as mes) s;
rollback;


-- ═══ PRUEBA 3: periodo inválido (ya no hay "hoy") ═══
-- Esperado: ERROR: PERIODO_INVALIDO
begin;
select set_config('prueba.dueno', p.user_id::text, true)
from public.profiles p join public.negocios ne on ne.id = p.negocio_id
where p.role = 'owner' and ne.activo is true order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select public.grafica_dueno('hoy');
rollback;


-- ═══ PRUEBA 4: un mesero no ve la gráfica ═══
-- (Necesita un perfil con rol "mesero".)
-- Esperado: ERROR: Acceso denegado
begin;
select set_config('prueba.mesero', p.user_id::text, true)
from public.profiles p where p.role = 'mesero' order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.mesero'), 'role', 'authenticated')::text, true);
select public.grafica_dueno('semana');
rollback;


-- ═══ PRUEBA 5: sin sesión no hay gráfica ═══
-- Esperado: ERROR: permission denied for function grafica_dueno
begin;
set local role anon;
select public.grafica_dueno('semana');
rollback;


-- ═══ PRUEBA 6: un mesero desactivado sale de "Tu equipo esta semana" ═══
-- (Necesita un mesero activo en el negocio del primer dueño.)
-- Esperado: mesero_antes true y mesero_despues false.
-- (Si dos meseros se llaman igual, mesero_despues puede salir true.)
begin;
select set_config('prueba.dueno', p.user_id::text, true),
       set_config('prueba.negocio', p.negocio_id::text, true)
from public.profiles p join public.negocios ne on ne.id = p.negocio_id
where p.role = 'owner' and ne.activo is true order by p.created_at limit 1;
select set_config('prueba.mesero', p.user_id::text, true),
       set_config('prueba.mesero_nombre', coalesce(nullif(btrim(p.nombre), ''), 'Mesero'), true)
from public.profiles p
where p.role = 'mesero' and p.activo and p.negocio_id = current_setting('prueba.negocio')::uuid
order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select set_config('prueba.antes',
  (public.resumen_meseros()->'meseros' @> jsonb_build_array(jsonb_build_object('nombre', current_setting('prueba.mesero_nombre'), 'rol', 'mesero')))::text, true);
reset role;
set local role service_role;
select public.baja_mesero(current_setting('prueba.mesero')::uuid, current_setting('prueba.negocio')::uuid);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select current_setting('prueba.antes')::boolean as mesero_antes,
       public.resumen_meseros()->'meseros' @> jsonb_build_array(jsonb_build_object('nombre', current_setting('prueba.mesero_nombre'), 'rol', 'mesero')) as mesero_despues;
rollback;

*/
