-- Fase 4: panel del dueño.
-- Los números del panel los calcula el servidor con funciones solo para el
-- dueño; el navegador nunca recibe la lista de clientes con teléfonos para
-- hacer cuentas.
--
-- Todo va en UNA transacción: si cualquier paso falla, no se aplica nada.
-- Correr completo en el editor SQL de Supabase. Las pruebas van al final,
-- DESPUÉS del commit, comentadas: se copian y se corren un bloque a la vez.
-- Requiere la Fase 3 (canjes y canje_intentos).
--
-- Qué hace:
--   1. negocios.ticket_promedio y negocios.costo_premio (opcionales),
--      profiles.nombre, y guardar_programa acepta ticket y costo.
--   2. resumen_dueno()       los números del panel.
--   3. clientes_inactivos()  quiénes dejaron de venir (sin teléfono completo).
--   4. resumen_meseros()     tabla por mesero con bandera "revisar".
--   5. El mesero deja de leer clientes y visitas directo.
--
-- Definiciones (en la zona horaria del negocio):
--   "esta semana"    = los últimos 7 días contando hoy (hoy - 6 a hoy).
--   "la anterior"    = los 7 días antes de esos (hoy - 13 a hoy - 7).
--   Se usan 7 días corridos y no "de lunes a hoy" para que un lunes no salga
--   siempre en rojo contra una semana completa.
--   visita repetida  = cualquier visita que no sea la primera del cliente.
--   inactivo         = su última visita fue hace más de 21 días.
--
-- Errores que verá la app (en error.message):
--   'Acceso denegado'   sin sesión o no es dueño
--   'NEGOCIO_INACTIVO'  el negocio está desactivado
--   'TICKET_INVALIDO'   ticket promedio fuera de $1 a $100,000
--   'COSTO_INVALIDO'    costo del premio fuera de $0 a $100,000
--   (más los de guardar_programa de la fase 2G)

begin;


-- ═══ 0. Comprobaciones previas ═══
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'canjes' and column_name = 'confirmado_en'
  ) or to_regclass('public.canje_intentos') is null then
    raise exception 'Falta la Fase 3 (canjes con estado y canje_intentos).';
  end if;
  if to_regclass('public.codigos') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'visitas' and column_name = 'dia_local'
     ) then
    raise exception 'Falta la fase 2A.';
  end if;
  if to_regprocedure('public.guardar_programa(integer, text, integer)') is null then
    raise exception 'No existe guardar_programa(integer, text, integer) (fase 2G); revisar antes de reemplazarla.';
  end if;
  if to_regprocedure('public.user_has_business_role(uuid, text[])') is null then
    raise exception 'Falta user_has_business_role (fase 3 de seguridad).';
  end if;
end;
$$;


-- ═══ 1. Columnas nuevas ═══
-- Opcionales: si el dueño no las llena, el panel no inventa pesos.
-- numeric(10,2): pesos con centavos. Rangos amplios pero sin absurdos.
alter table public.negocios
  add column if not exists ticket_promedio numeric(10, 2),
  add column if not exists costo_premio numeric(10, 2);

alter table public.negocios
  drop constraint if exists negocios_ticket_promedio_rango,
  add constraint negocios_ticket_promedio_rango
    check (ticket_promedio is null or ticket_promedio between 1 and 100000),
  drop constraint if exists negocios_costo_premio_rango,
  add constraint negocios_costo_premio_rango
    check (costo_premio is null or costo_premio between 0 and 100000);

-- negocios usa permisos por columna: hay que dar lectura explícita.
-- Nadie las modifica directo: se guardan con guardar_programa.
grant select (ticket_promedio, costo_premio) on public.negocios to authenticated;

-- Nombre corto del mesero (o del dueño) para la tabla por mesero.
-- Por ahora se llena a mano en Supabase; la pantalla para ponerlo llega
-- con el alta de meseros.
alter table public.profiles
  add column if not exists nombre text;

alter table public.profiles
  drop constraint if exists profiles_nombre_largo,
  add constraint profiles_nombre_largo
    check (nombre is null or length(btrim(nombre)) between 1 and 30);

-- Para contar rápido las visitas del negocio por día (panel).
create index if not exists visitas_negocio_dia_idx
on public.visitas (negocio_id, dia_local);


-- ═══ 2. guardar_programa con ticket y costo ═══
-- Se borra la versión de 3 parámetros y se crea la de 5. Ticket y costo son
-- opcionales: null (o no mandarlos) = "sin dato" y borra el valor guardado.
-- Ojo: una app vieja en caché que mande solo 3 parámetros los dejaría en
-- null; por eso se sube la versión del service worker en la parte B.
-- No se dejan las dos versiones: con valores por defecto, la API no sabría
-- cuál llamar.
drop function public.guardar_programa(integer, text, integer);

create function public.guardar_programa(
  p_meta_puntos integer,
  p_premio text,
  p_max_codigos_activos integer,
  p_ticket_promedio numeric default null,
  p_costo_premio numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio public.negocios%rowtype;
  v_premio text;
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

  if p_meta_puntos is null or p_meta_puntos not between 1 and 100 then
    raise exception 'META_INVALIDA';
  end if;

  -- Espacios repetidos se juntan: "  café   gratis " → "café gratis".
  v_premio := btrim(regexp_replace(coalesce(p_premio, ''), '\s+', ' ', 'g'));
  if v_premio = '' or length(v_premio) > 80 then
    raise exception 'PREMIO_INVALIDO';
  end if;

  if p_max_codigos_activos is null or p_max_codigos_activos not between 1 and 50 then
    raise exception 'MAX_CODIGOS_INVALIDO';
  end if;

  if p_ticket_promedio is not null and p_ticket_promedio not between 1 and 100000 then
    raise exception 'TICKET_INVALIDO';
  end if;
  if p_costo_premio is not null and p_costo_premio not between 0 and 100000 then
    raise exception 'COSTO_INVALIDO';
  end if;

  update public.negocios
  set meta_puntos = p_meta_puntos,
      premio = v_premio,
      max_codigos_activos = p_max_codigos_activos,
      ticket_promedio = round(p_ticket_promedio, 2),
      costo_premio = round(p_costo_premio, 2)
  where id = v_negocio.id
  returning * into v_negocio;

  return jsonb_build_object(
    'meta_puntos', v_negocio.meta_puntos,
    'premio', v_negocio.premio,
    'max_codigos_activos', v_negocio.max_codigos_activos,
    'ticket_promedio', v_negocio.ticket_promedio,
    'costo_premio', v_negocio.costo_premio
  );
end;
$$;


-- ═══ 3. resumen_dueno() ═══
-- Todos los números del panel en una sola llamada. Solo lee.
create or replace function public.resumen_dueno()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio public.negocios%rowtype;
  v_hoy date;
  v_desde date;        -- primer día de "esta semana"
  v_desde_ant date;    -- primer día de "la anterior"
  v_meta integer;
  v_visitas jsonb;
  v_clientes jsonb;
  v_entregados bigint;
  v_repetidas bigint;
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

  v_hoy := (now() at time zone v_negocio.zona_horaria)::date;
  v_desde := v_hoy - 6;
  v_desde_ant := v_hoy - 13;
  v_meta := coalesce(v_negocio.meta_puntos, 10);

  -- Visitas: n = número de visita del cliente (1 = la primera).
  with vis as (
    select v.cliente_id,
           v.dia_local,
           row_number() over (partition by v.cliente_id order by v.fecha, v.id) as n
    from public.visitas v
    where v.negocio_id = v_negocio.id
      and v.cliente_id is not null
  ),
  ultimas as (
    select cliente_id, max(dia_local) as ultima
    from vis
    group by cliente_id
  )
  select jsonb_build_object(
    'visitas_semana',
      (select count(*) from vis where dia_local between v_desde and v_hoy),
    'visitas_semana_anterior',
      (select count(*) from vis where dia_local between v_desde_ant and v_desde - 1),
    'visitas_repetidas_semana',
      (select count(*) from vis where dia_local between v_desde and v_hoy and n > 1),
    'regresaron_semana',
      (select count(distinct cliente_id) from vis where dia_local between v_desde and v_hoy and n > 1),
    'inactivos',
      (select count(*) from ultimas where ultima < v_hoy - 21)
  ) into v_visitas;

  -- Clientes: registrados, % con 2 o más visitas y premios listos.
  select jsonb_build_object(
    'clientes_registrados', count(*),
    'porcentaje_regresan', coalesce(round(100.0 * count(*) filter (where coalesce(cl.total_visitas, 0) >= 2) / nullif(count(*), 0)), 0),
    'premios_listos', count(*) filter (where coalesce(cl.puntos_actuales, 0) >= v_meta)
  ) into v_clientes
  from public.clientes cl
  where cl.negocio_id = v_negocio.id;

  -- Premios entregados esta semana (por el día en que se confirmó).
  select count(*) into v_entregados
  from public.canjes c
  where c.negocio_id = v_negocio.id
    and c.estado = 'entregado'
    and (c.confirmado_en at time zone v_negocio.zona_horaria)::date between v_desde and v_hoy;

  v_repetidas := (v_visitas->>'visitas_repetidas_semana')::bigint;

  return v_visitas || v_clientes || jsonb_build_object(
    'negocio', jsonb_build_object(
      'nombre', v_negocio.nombre,
      'meta', v_meta,
      'premio', v_negocio.premio,
      'ticket_promedio', v_negocio.ticket_promedio,
      'costo_premio', v_negocio.costo_premio
    ),
    'hoy', v_hoy,
    'semana_desde', v_desde,
    -- Sin ticket promedio no se inventan pesos: null.
    'ventas_estimadas', case
      when v_negocio.ticket_promedio is null then null
      else round(v_repetidas * v_negocio.ticket_promedio, 2)
    end,
    'premios_entregados_semana', v_entregados,
    'costo_premios_semana', case
      when v_negocio.costo_premio is null then null
      else round(v_entregados * v_negocio.costo_premio, 2)
    end
  );
end;
$$;


-- ═══ 4. clientes_inactivos() ═══
-- Quienes no vienen hace más de 21 días: primer nombre, últimos 4 dígitos,
-- última visita, días sin venir y visitas totales. Nunca el teléfono completo.
-- Los que se fueron hace menos tiempo van primero (son los más fáciles de
-- recuperar). Máximo 300.
create or replace function public.clientes_inactivos()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio public.negocios%rowtype;
  v_hoy date;
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

  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre', coalesce(t.nombre, 'Cliente'),
           'ultimos4', right(t.telefono, 4),
           'ultima_visita', t.ultima,
           'dias', v_hoy - t.ultima,
           'visitas', t.visitas
         ) order by t.ultima desc, t.nombre), '[]'::jsonb)
  into v_lista
  from (
    select cl.nombre, cl.telefono, max(v.dia_local) as ultima, count(*) as visitas
    from public.clientes cl
    join public.visitas v on v.cliente_id = cl.id and v.negocio_id = v_negocio.id
    where cl.negocio_id = v_negocio.id
    group by cl.id, cl.nombre, cl.telefono
    having max(v.dia_local) < v_hoy - 21
    order by max(v.dia_local) desc
    limit 300
  ) t;

  return jsonb_build_object('clientes', v_lista);
end;
$$;


-- ═══ 5. resumen_meseros() ═══
-- Por persona del equipo, esta semana: códigos generados, reclamados,
-- capturas manuales y bloqueos de canje. Aparecen todos los meseros (aunque
-- no hayan hecho nada) y el dueño solo si cobró o capturó algo.
--
-- Bandera "revisar" (umbrales simples, a ajustar con datos del piloto):
--   A. 5 o más códigos y menos de la mitad reclamados
--      → "Muchos códigos sin usar". Puede ser normal (clientes que no
--        escanean), pero también códigos sin venta detrás.
--   B. 5 o más capturas manuales y más capturas que códigos reclamados
--      → "Más capturas a mano que códigos escaneados".
--   C. Se bloqueó por códigos de canje incorrectos en los últimos 7 días
--      → "Escribió mal el código de canje muchas veces".
-- bloqueos_canje es el total histórico: canje_intentos (Fase 3) no guarda
-- la fecha de cada bloqueo, solo el último (que se usa para la regla C).
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


-- ═══ 6. Permisos de las funciones ═══
-- Solo con sesión; cada función revisa además que sea el dueño.
revoke all on function public.guardar_programa(integer, text, integer, numeric, numeric) from public, anon, authenticated;
revoke all on function public.resumen_dueno() from public, anon, authenticated;
revoke all on function public.clientes_inactivos() from public, anon, authenticated;
revoke all on function public.resumen_meseros() from public, anon, authenticated;

grant execute on function public.guardar_programa(integer, text, integer, numeric, numeric) to authenticated;
grant execute on function public.resumen_dueno() to authenticated;
grant execute on function public.clientes_inactivos() to authenticated;
grant execute on function public.resumen_meseros() to authenticated;


-- ═══ 7. El mesero ya no lee clientes ni visitas directo ═══
-- Revisado en el código (src/pages.js y src/auth.js): con la sesión del
-- mesero solo se leen profiles, negocios (color) y codigos (los suyos), más
-- las funciones RPC (todas security definer). Ninguna lectura directa de
-- clientes ni visitas; Realtime solo escucha codigos.
--
-- Los permisos de tabla son por rol de base de datos ("authenticated"), que
-- comparten el mesero y el dueño: no se pueden quitar solo al mesero sin
-- quitárselos al dueño (que los usa para exportar su lista de clientes).
-- Por eso el cierre está en las políticas: solo el dueño ve filas.
drop policy if exists clientes_select_member on public.clientes;
drop policy if exists visitas_select_member on public.visitas;
drop policy if exists clientes_select_owner on public.clientes;
drop policy if exists visitas_select_owner on public.visitas;

create policy clientes_select_owner
on public.clientes for select to authenticated
using (public.user_has_business_role(negocio_id, array['owner']));

create policy visitas_select_owner
on public.visitas for select to authenticated
using (public.user_has_business_role(negocio_id, array['owner']));


-- ═══ 8. Comprobaciones finales ═══
do $$
declare
  v_funcion text;
begin
  -- Columnas nuevas y lectura para authenticated.
  if not has_column_privilege('authenticated', 'public.negocios', 'ticket_promedio', 'select')
     or not has_column_privilege('authenticated', 'public.negocios', 'costo_premio', 'select') then
    raise exception 'authenticated debe poder leer ticket_promedio y costo_premio.';
  end if;
  if has_column_privilege('authenticated', 'public.negocios', 'ticket_promedio', 'update')
     or has_column_privilege('authenticated', 'public.negocios', 'costo_premio', 'update') then
    raise exception 'ticket_promedio y costo_premio solo se cambian con guardar_programa.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'nombre'
  ) then
    raise exception 'Falta profiles.nombre.';
  end if;

  -- guardar_programa: solo la versión nueva.
  if to_regprocedure('public.guardar_programa(integer, text, integer)') is not null then
    raise exception 'Quedó la versión vieja de guardar_programa.';
  end if;

  -- Funciones: security definer, search_path vacío, solo authenticated.
  foreach v_funcion in array array[
    'public.guardar_programa(integer, text, integer, numeric, numeric)',
    'public.resumen_dueno()',
    'public.clientes_inactivos()',
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

  -- clientes y visitas: una sola política de lectura, la del dueño.
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'clientes') <> 1
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'clientes' and policyname = 'clientes_select_owner') then
    raise exception 'clientes debe tener solo la política clientes_select_owner.';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'visitas') <> 1
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'visitas' and policyname = 'visitas_select_owner') then
    raise exception 'visitas debe tener solo la política visitas_select_owner.';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.clientes'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.visitas'::regclass) then
    raise exception 'clientes y visitas deben tener RLS.';
  end if;

  -- anon no lee clientes ni visitas.
  if has_table_privilege('anon', 'public.clientes', 'select')
     or has_any_column_privilege('anon', 'public.clientes', 'select')
     or has_table_privilege('anon', 'public.visitas', 'select')
     or has_any_column_privilege('anon', 'public.visitas', 'select') then
    raise exception 'anon no debe poder leer clientes ni visitas.';
  end if;
end;
$$;


commit;


-- ═══════════════════════════════════════════════════════════════════════
-- PRUEBAS (correr DESPUÉS de aplicar lo de arriba)
-- ═══════════════════════════════════════════════════════════════════════
-- Copia UN bloque a la vez (de begin a rollback) en el editor SQL.
-- Todos terminan en rollback: no queda nada guardado.
--
-- Las pruebas 1 a 3 usan un NEGOCIO DE PRUEBA vacío para que los números
-- sean exactos: crean el negocio, "prestan" a un dueño real moviendo su
-- perfil a ese negocio (solo dentro de la prueba; el rollback lo regresa)
-- y cargan estos datos (meta 3, ticket $100, premio cuesta $20):
--   Ana  (···0401): visitas hace 20, 10 y 2 días; 3 puntos (premio listo)
--                   y un premio entregado ayer.
--   Luis (···0402): una visita ayer (su primera).
--   Eva  (···0403): visitas hace 40 y 30 días (dejó de venir).
-- Para actuar como dueño o mesero:
--   set local role authenticated;
--   select set_config('request.jwt.claims', ...)   ← auth.uid() lee el "sub"
/*

-- ═══ PRUEBA 1: los números del resumen ═══
-- Esperado: clientes_registrados 3, visitas_semana 2, visitas_semana_anterior 1,
-- visitas_repetidas_semana 1, regresaron_semana 1, porcentaje_regresan 67,
-- ventas_estimadas 100.00, premios_entregados_semana 1, costo_premios_semana 20.00,
-- premios_listos 1, inactivos 1.
begin;
with n as (
  insert into public.negocios (nombre, email, meta_puntos, premio, ticket_promedio, costo_premio)
  values ('Prueba Fase 4', 'prueba-fase-4@example.invalid', 3, 'Un café', 100, 20)
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
  values (current_setting('prueba.negocio')::uuid, '+529980000401', 'Ana', 3, 3),
         (current_setting('prueba.negocio')::uuid, '+529980000402', 'Luis', 1, 1),
         (current_setting('prueba.negocio')::uuid, '+529980000403', 'Eva', 2, 2)
  returning id, nombre
)
insert into public.visitas (cliente_id, negocio_id, fecha, origen)
select c.id, current_setting('prueba.negocio')::uuid, now() - x.dias * interval '1 day', 'qr'
from c join (values ('Ana', 20), ('Ana', 10), ('Ana', 2), ('Luis', 1), ('Eva', 40), ('Eva', 30)) as x(nombre, dias)
  on x.nombre = c.nombre;
insert into public.canjes (negocio_id, cliente_id, codigo, estado, creado_en, expira_en, premio_texto, puntos_descontados, confirmado_en)
select current_setting('prueba.negocio')::uuid, cl.id, '1234', 'entregado',
       now() - interval '1 day 5 minutes', now() - interval '1 day', 'Un café', 3, now() - interval '1 day 2 minutes'
from public.clientes cl
where cl.negocio_id = current_setting('prueba.negocio')::uuid and cl.nombre = 'Ana';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select public.resumen_dueno();
rollback;


-- ═══ PRUEBA 2: quiénes dejaron de venir ═══
-- Esperado: {"clientes": [{"nombre": "Eva", "ultimos4": "0403", "dias": 30,
-- "visitas": 2, "ultima_visita": ...}]}  (sin teléfono completo)
-- (Los "dias" pueden salir 29 o 31 si la prueba corre cerca de medianoche.)
begin;
with n as (
  insert into public.negocios (nombre, email, meta_puntos, premio, ticket_promedio, costo_premio)
  values ('Prueba Fase 4', 'prueba-fase-4@example.invalid', 3, 'Un café', 100, 20)
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
  values (current_setting('prueba.negocio')::uuid, '+529980000401', 'Ana', 3, 3),
         (current_setting('prueba.negocio')::uuid, '+529980000402', 'Luis', 1, 1),
         (current_setting('prueba.negocio')::uuid, '+529980000403', 'Eva', 2, 2)
  returning id, nombre
)
insert into public.visitas (cliente_id, negocio_id, fecha, origen)
select c.id, current_setting('prueba.negocio')::uuid, now() - x.dias * interval '1 day', 'qr'
from c join (values ('Ana', 20), ('Ana', 10), ('Ana', 2), ('Luis', 1), ('Eva', 40), ('Eva', 30)) as x(nombre, dias)
  on x.nombre = c.nombre;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select public.clientes_inactivos();
rollback;


-- ═══ PRUEBA 3: tabla por mesero con "revisar" ═══
-- El dueño prestado genera 6 códigos (1 reclamado) y captura 5 visitas a mano.
-- Esperado: una fila con nombre (su profiles.nombre o "Dueño"), rol "owner",
-- generados 6, reclamados 1, manuales 5, revisar true y motivo
-- "Muchos códigos sin usar (1 de 6) · Más capturas a mano que códigos escaneados".
begin;
with n as (
  insert into public.negocios (nombre, email, meta_puntos, premio)
  values ('Prueba Fase 4', 'prueba-fase-4@example.invalid', 3, 'Un café')
  returning id
)
select set_config('prueba.negocio', id::text, true) from n;
select set_config('prueba.dueno', p.user_id::text, true)
from public.profiles p join public.negocios ne on ne.id = p.negocio_id
where p.role = 'owner' and ne.activo is true order by p.created_at limit 1;
update public.profiles set negocio_id = current_setting('prueba.negocio')::uuid
where user_id = current_setting('prueba.dueno')::uuid;
insert into public.codigos (negocio_id, codigo, creado_por, expira_en, reclamado_en)
select current_setting('prueba.negocio')::uuid, 'prueba-f4-' || g || repeat('0', 30),
       current_setting('prueba.dueno')::uuid, now() + interval '10 minutes',
       case when g = 1 then now() end
from generate_series(1, 6) g;
with c as (
  insert into public.clientes (negocio_id, telefono, nombre, puntos_actuales, total_visitas)
  select current_setting('prueba.negocio')::uuid, '+5299800005' || lpad(g::text, 2, '0'), 'Cliente', 1, 1
  from generate_series(1, 5) g
  returning id
)
insert into public.visitas (cliente_id, negocio_id, origen, mesero_id)
select c.id, current_setting('prueba.negocio')::uuid, 'manual', current_setting('prueba.dueno')::uuid
from c;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select public.resumen_meseros();
rollback;


-- ═══ PRUEBA 4: guardar ticket y costo ═══
-- Esperado: "ticket_promedio": 150.50 y "costo_premio": null.
begin;
select set_config('prueba.dueno', p.user_id::text, true),
       set_config('prueba.meta', coalesce(ne.meta_puntos, 10)::text, true),
       set_config('prueba.premio', coalesce(nullif(ne.premio, ''), 'Un café gratis'), true),
       set_config('prueba.max', ne.max_codigos_activos::text, true)
from public.profiles p join public.negocios ne on ne.id = p.negocio_id
where p.role = 'owner' and ne.activo is true order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select public.guardar_programa(current_setting('prueba.meta')::int, current_setting('prueba.premio'),
                               current_setting('prueba.max')::int, 150.5, null);
rollback;


-- ═══ PRUEBA 5: ticket fuera de rango ═══
-- Esperado: ERROR: TICKET_INVALIDO
begin;
select set_config('prueba.dueno', p.user_id::text, true)
from public.profiles p join public.negocios ne on ne.id = p.negocio_id
where p.role = 'owner' and ne.activo is true order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select public.guardar_programa(10, 'Un café gratis', 3, 0, null);
rollback;


-- ═══ PRUEBA 6: un mesero no ve el resumen ═══
-- (Necesita que exista al menos un perfil con rol "mesero".)
-- Esperado: ERROR: Acceso denegado
begin;
select set_config('prueba.mesero', p.user_id::text, true)
from public.profiles p where p.role = 'mesero' order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.mesero'), 'role', 'authenticated')::text, true);
select public.resumen_dueno();
rollback;


-- ═══ PRUEBA 7: un mesero ya no lee clientes ni visitas directo ═══
-- (Necesita un perfil con rol "mesero".)
-- Esperado: clientes_visibles 0 y visitas_visibles 0 (aunque su negocio tenga datos).
begin;
select set_config('prueba.mesero', p.user_id::text, true)
from public.profiles p where p.role = 'mesero' order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.mesero'), 'role', 'authenticated')::text, true);
select (select count(*) from public.clientes) as clientes_visibles,
       (select count(*) from public.visitas) as visitas_visibles;
rollback;


-- ═══ PRUEBA 8: el dueño sí lee sus clientes (para exportar) ═══
-- Esperado: clientes_visibles = los clientes de su negocio (y de ningún otro).
begin;
select set_config('prueba.dueno', p.user_id::text, true),
       set_config('prueba.negocio', p.negocio_id::text, true)
from public.profiles p join public.negocios ne on ne.id = p.negocio_id
where p.role = 'owner' and ne.activo is true order by p.created_at limit 1;
select set_config('prueba.esperados', count(*)::text, true)
from public.clientes where negocio_id = current_setting('prueba.negocio')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select (select count(*) from public.clientes) as clientes_visibles,
       current_setting('prueba.esperados') as esperados;
rollback;


-- ═══ PRUEBA 9: sin sesión no hay resumen ═══
-- Esperado: ERROR: permission denied for function resumen_dueno
begin;
set local role anon;
select public.resumen_dueno();
rollback;

*/
