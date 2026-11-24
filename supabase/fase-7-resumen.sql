-- Fase 7 (Fase B del Resumen del dueño), paso 1: funciones de lectura.
-- NO EJECUTADO. Para revisar. Solo SQL: la pantalla llega en el paso 2.
-- Requiere las fases 2A, 3 (canjes), 4, 4C, 4D, 6 (anular visita) y 6B.
-- Todo va en UNA transacción: si cualquier paso falla, no se aplica nada.
-- Las pruebas van al final, DESPUÉS del commit, comentadas: se copian y se
-- corren un bloque a la vez. Todas terminan en rollback.
--
-- Solo AGREGA funciones. No modifica ni borra resumen_dueno, grafica_dueno,
-- clientes_inactivos ni ninguna otra (se usa "create function", no "create
-- or replace": si alguna ya existiera, falla y no se aplica nada; y al final
-- se comprueba que las existentes quedaron idénticas).
--
-- Funciones nuevas (todas: security definer, search_path vacío, stable,
-- solo el dueño de un negocio activo, el negocio sale de la sesión, sin
-- visitas anuladas, y nunca devuelven teléfonos; a lo más los últimos 4):
--   1. resumen_inicio()                  la tarjeta protagonista.
--   2. resumen_periodo('mes'|'semana')   3 números con su periodo anterior.
--   3. clientes_cerca_premio()           a 1 visita de su premio.
--   4. actividad_reciente(límite)        "Lo que está pasando".
--   5. grafica_regresos()                visitas de regreso por semana.
--
-- Definiciones (las mismas que ya usa resumen_dueno):
--   Visita válida   visitas.anulada_en is null y con cliente.
--   Orden           por (fecha, id): la primera visita válida de un cliente
--                   es su visita 1; las siguientes son "visitas de regreso".
--   Cliente nuevo   cliente cuya PRIMERA visita válida cae en el periodo.
--                   (No se usa clientes.fecha_registro: es "timestamp sin
--                   zona" y, si su primera visita se anuló, no vino de verdad.)
--   Día             visitas.dia_local (ya está en la zona del negocio); los
--                   canjes por confirmado_en llevado a la zona del negocio.
--
-- Errores (igual que el resto del panel):
--   'Acceso denegado'   sin sesión, no es dueño o su cuenta está desactivada
--   'NEGOCIO_INACTIVO'  el negocio está desactivado
--   'PERIODO_INVALIDO'  resumen_periodo con algo distinto de 'mes' o 'semana'

begin;


-- ═══ 0. Comprobaciones previas ═══
do $$
declare
  v_funcion text;
begin
  foreach v_funcion in array array[
    'public.user_has_business_role(uuid, text[])',
    'public.resumen_dueno()',
    'public.grafica_dueno(text)',
    'public.clientes_inactivos()',
    'public.resumen_meseros()',
    'public.anular_visita(uuid, text)',
    'public.impacto_programa(integer)'
  ] loop
    if to_regprocedure(v_funcion) is null then
      raise exception 'Falta % (revisar qué fase no se ha aplicado).', v_funcion;
    end if;
  end loop;

  -- Las funciones nuevas NO deben existir (este archivo solo agrega).
  foreach v_funcion in array array[
    'public.resumen_inicio()',
    'public.resumen_periodo(text)',
    'public.clientes_cerca_premio()',
    'public.actividad_reciente(integer)',
    'public.grafica_regresos()'
  ] loop
    if to_regprocedure(v_funcion) is not null then
      raise exception '% ya existe: este archivo solo agrega funciones nuevas.', v_funcion;
    end if;
  end loop;

  -- Columnas que se leen.
  if (select count(*) from information_schema.columns
      where table_schema = 'public' and (table_name, column_name) in (
        ('visitas', 'anulada_en'), ('visitas', 'dia_local'), ('visitas', 'fecha'),
        ('canjes', 'confirmado_en'), ('canjes', 'estado'), ('canjes', 'negocio_id'),
        ('negocios', 'zona_horaria'), ('negocios', 'ticket_promedio'),
        ('negocios', 'meta_puntos'), ('negocios', 'fecha_creacion'),
        ('clientes', 'puntos_actuales'), ('numeros_excluidos', 'telefono')
      )) <> 12 then
    raise exception 'Faltan columnas (anulación de la Fase 6, canjes de la Fase 3 o ticket de la Fase 4).';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'visitas'
      and column_name = 'fecha' and data_type = 'timestamp with time zone'
  ) then
    raise exception 'visitas.fecha debe ser timestamptz (fase 2A).';
  end if;

  -- negocios.fecha_creacion es "timestamp sin zona" guardado en UTC (default
  -- now() con la base en UTC). Si cambia, revisar la conversión a hora local.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'negocios'
      and column_name = 'fecha_creacion' and data_type = 'timestamp without time zone'
  ) then
    raise exception 'negocios.fecha_creacion cambió de tipo: revisar la conversión antes de aplicar.';
  end if;
  if current_setting('TimeZone') not in ('UTC', 'Etc/UTC') then
    raise exception 'La base no está en UTC (%): revisar cómo se guardó negocios.fecha_creacion.', current_setting('TimeZone');
  end if;
end;
$$;

-- Huella de las funciones existentes del panel, para comprobar al final que
-- este archivo no las tocó. Se guarda en una variable de la transacción
-- (set_config local): el editor de Supabase no conserva tablas temporales.
-- Formato: "función:md5,función:md5,..." ordenado por nombre.
select set_config('fase7.huellas', (
  select string_agg(p.oid::regprocedure::text || ':' || md5(p.prosrc), ',' order by p.oid::regprocedure::text)
  from pg_proc p
  where p.oid in (
    to_regprocedure('public.resumen_dueno()'),
    to_regprocedure('public.grafica_dueno(text)'),
    to_regprocedure('public.clientes_inactivos()'),
    to_regprocedure('public.resumen_meseros()')
  )
), true);


-- ═══ 1. resumen_inicio() ═══
-- La tarjeta protagonista. Desde el inicio (no por periodo):
--   clientes_regresaron     clientes con 2 o más visitas válidas
--   visitas_regreso_total   visitas válidas que no son la primera del cliente
--   ventas_estimadas_total  visitas_regreso_total × ticket_promedio (null sin ticket)
--   desde                   día de la primera visita válida (null sin visitas)
--   clientes_registrados    clientes del negocio
--   proximo_logro           el menor de 10, 25, 50, 100, 250, 500, 1000
--                           mayor que los registrados (null si ya pasó 1000)
create function public.resumen_inicio()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio public.negocios%rowtype;
  v_regresaron bigint;
  v_regresos bigint;
  v_desde date;
  v_registrados bigint;
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

  -- Una pasada por las visitas válidas del negocio, agrupada por cliente.
  select coalesce(count(*) filter (where t.visitas >= 2), 0),
         coalesce(sum(t.visitas - 1), 0),
         min(t.primera)
  into v_regresaron, v_regresos, v_desde
  from (
    select v.cliente_id, count(*) as visitas, min(v.dia_local) as primera
    from public.visitas v
    where v.negocio_id = v_negocio.id
      and v.cliente_id is not null
      and v.anulada_en is null
    group by v.cliente_id
  ) t;

  select count(*) into v_registrados
  from public.clientes cl
  where cl.negocio_id = v_negocio.id;

  return jsonb_build_object(
    'clientes_regresaron', v_regresaron,
    'visitas_regreso_total', v_regresos,
    -- Sin ticket promedio no se inventan pesos: null.
    'ventas_estimadas_total', case
      when v_negocio.ticket_promedio is null then null
      else round(v_regresos * v_negocio.ticket_promedio, 2)
    end,
    'ticket_promedio', v_negocio.ticket_promedio,
    'desde', v_desde,
    'clientes_registrados', v_registrados,
    'proximo_logro', (
      select min(x) from unnest(array[10, 25, 50, 100, 250, 500, 1000]) as x
      where x > v_registrados
    )
  );
end;
$$;

revoke all on function public.resumen_inicio() from public, anon, authenticated;
grant execute on function public.resumen_inicio() to authenticated;


-- ═══ 2. resumen_periodo(periodo) ═══
-- Tres números del periodo actual y del anterior A LA MISMA FECHA:
--   'semana'  últimos 7 días (hoy incluido) contra los 7 anteriores.
--   'mes'     del día 1 de este mes a hoy contra del día 1 del mes anterior
--             al mismo día del mes, sin pasarse de su último día
--             (31 de marzo → del 1 al 28/29 de febrero).
-- anterior_con_datos: false si el negocio no existía durante TODO el periodo
-- anterior (se toma como inicio el más antiguo entre su fecha de creación y
-- su primera visita válida). Así la app no compara contra un periodo vacío o
-- a medias ("subió 300 %").
create function public.resumen_periodo(p_periodo text)
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
  v_ini date;          -- periodo actual: v_ini .. v_hoy
  v_ant_ini date;      -- periodo anterior: v_ant_ini .. v_ant_fin
  v_ant_fin date;
  v_inicio_negocio date;
  v_nuevos bigint;
  v_nuevos_ant bigint;
  v_regreso bigint;
  v_regreso_ant bigint;
  v_premios bigint;
  v_premios_ant bigint;
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
  if p_periodo is null or p_periodo not in ('mes', 'semana') then
    raise exception 'PERIODO_INVALIDO';
  end if;

  v_tz := v_negocio.zona_horaria;
  v_hoy := (now() at time zone v_tz)::date;

  if p_periodo = 'semana' then
    v_ini := v_hoy - 6;
    v_ant_ini := v_hoy - 13;
    v_ant_fin := v_hoy - 7;
  else
    v_ini := date_trunc('month', v_hoy)::date;
    v_ant_ini := (v_ini - interval '1 month')::date;
    v_ant_fin := least(v_ant_ini + (v_hoy - v_ini), v_ini - 1);
  end if;

  -- Visitas válidas desde el inicio del periodo anterior; cada una sabe si
  -- es de regreso (hay otra visita válida del cliente antes que ella).
  select count(*) filter (where t.dia_local between v_ini and v_hoy and not t.regreso),
         count(*) filter (where t.dia_local between v_ant_ini and v_ant_fin and not t.regreso),
         count(*) filter (where t.dia_local between v_ini and v_hoy and t.regreso),
         count(*) filter (where t.dia_local between v_ant_ini and v_ant_fin and t.regreso)
  into v_nuevos, v_nuevos_ant, v_regreso, v_regreso_ant
  from (
    select v.dia_local,
           exists (
             select 1 from public.visitas v2
             where v2.cliente_id = v.cliente_id
               and v2.negocio_id = v_negocio.id
               and v2.anulada_en is null
               and (v2.fecha, v2.id) < (v.fecha, v.id)
           ) as regreso
    from public.visitas v
    where v.negocio_id = v_negocio.id
      and v.cliente_id is not null
      and v.anulada_en is null
      and v.dia_local between v_ant_ini and v_hoy
  ) t;

  -- Premios entregados (por el día en que se confirmó la entrega).
  select count(*) filter (where t.dia between v_ini and v_hoy),
         count(*) filter (where t.dia between v_ant_ini and v_ant_fin)
  into v_premios, v_premios_ant
  from (
    select (c.confirmado_en at time zone v_tz)::date as dia
    from public.canjes c
    where c.negocio_id = v_negocio.id
      and c.estado = 'entregado'
      and c.confirmado_en >= (v_ant_ini::timestamp at time zone v_tz)
  ) t;

  -- ¿Desde cuándo existe el negocio?
  select least(
    ((v_negocio.fecha_creacion at time zone 'UTC') at time zone v_tz)::date,
    (select min(v.dia_local) from public.visitas v
     where v.negocio_id = v_negocio.id and v.cliente_id is not null and v.anulada_en is null)
  ) into v_inicio_negocio;

  return jsonb_build_object(
    'periodo', p_periodo,
    'desde', v_ini,
    'hasta', v_hoy,
    'anterior_desde', v_ant_ini,
    'anterior_hasta', v_ant_fin,
    'anterior_con_datos', coalesce(v_inicio_negocio <= v_ant_ini, false),
    'clientes_nuevos', jsonb_build_object('actual', v_nuevos, 'anterior', v_nuevos_ant),
    'visitas_regreso', jsonb_build_object('actual', v_regreso, 'anterior', v_regreso_ant),
    'premios_entregados', jsonb_build_object('actual', v_premios, 'anterior', v_premios_ant)
  );
end;
$$;

revoke all on function public.resumen_periodo(text) from public, anon, authenticated;
grant execute on function public.resumen_periodo(text) to authenticated;


-- ═══ 3. clientes_cerca_premio() ═══
-- Clientes a 1 visita de su premio (puntos_actuales = meta - 1), sin los
-- números del personal. Solo primer nombre y últimos 4 dígitos, máximo 50
-- (los que vinieron más recientemente primero). "total" dice cuántos son en
-- realidad aunque pasen de 50. Con meta 1 no hay nadie "a 1 visita".
create function public.clientes_cerca_premio()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio public.negocios%rowtype;
  v_meta integer;
  v_lista jsonb;
  v_total bigint;
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

  v_meta := coalesce(v_negocio.meta_puntos, 10);

  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre', t.nombre,
           'ultimos4', t.ultimos4
         ) order by t.ultima desc nulls last, t.nombre), '[]'::jsonb),
         coalesce(max(t.total), 0)
  into v_lista, v_total
  from (
    select coalesce(nullif(split_part(btrim(coalesce(cl.nombre, '')), ' ', 1), ''), 'Cliente') as nombre,
           right(cl.telefono, 4) as ultimos4,
           (select max(v.fecha) from public.visitas v
            where v.cliente_id = cl.id and v.anulada_en is null) as ultima,
           count(*) over () as total
    from public.clientes cl
    where cl.negocio_id = v_negocio.id
      and v_meta >= 2
      and coalesce(cl.puntos_actuales, 0) = v_meta - 1
      and not exists (
        select 1 from public.numeros_excluidos e
        where e.negocio_id = v_negocio.id and e.telefono = cl.telefono
      )
    order by ultima desc nulls last, nombre
    limit 50
  ) t;

  return jsonb_build_object('total', v_total, 'meta', v_meta, 'clientes', v_lista);
end;
$$;

revoke all on function public.clientes_cerca_premio() from public, anon, authenticated;
grant execute on function public.clientes_cerca_premio() to authenticated;


-- ═══ 4. actividad_reciente(límite) ═══
-- Lo más nuevo primero, de 1 a 20 filas (5 si no se dice). Cada fila:
--   tipo    'nuevo' (primera visita válida del cliente), 'regreso' o 'canje'
--   numero  qué visita fue (1, 2, 3...); null en canjes
--   nombre  solo el primer nombre
--   fecha   fecha con hora (timestamptz)
-- Solo se numeran las visitas que salen en la lista (no todo el historial).
create function public.actividad_reciente(p_limite integer default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio public.negocios%rowtype;
  v_limite integer;
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

  v_limite := least(greatest(coalesce(p_limite, 5), 1), 20);

  with ult_visitas as (
    select v.id, v.cliente_id, v.fecha
    from public.visitas v
    where v.negocio_id = v_negocio.id
      and v.cliente_id is not null
      and v.anulada_en is null
    order by v.dia_local desc, v.fecha desc, v.id desc
    limit v_limite
  ),
  ult_canjes as (
    select c.cliente_id, c.confirmado_en as fecha
    from public.canjes c
    where c.negocio_id = v_negocio.id
      and c.estado = 'entregado'
    order by c.confirmado_en desc
    limit v_limite
  ),
  todo as (
    select 'visita'::text as clase, uv.id, uv.cliente_id, uv.fecha from ult_visitas uv
    union all
    select 'canje'::text, null::uuid, uc.cliente_id, uc.fecha from ult_canjes uc
    order by fecha desc
    limit v_limite
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'tipo', case
                     when t.clase = 'canje' then 'canje'
                     when k.numero = 1 then 'nuevo'
                     else 'regreso'
                   end,
           'numero', case when t.clase = 'visita' then k.numero end,
           'nombre', coalesce(nullif(split_part(btrim(coalesce(cl.nombre, '')), ' ', 1), ''), 'Cliente'),
           'fecha', t.fecha
         ) order by t.fecha desc), '[]'::jsonb)
  into v_lista
  from todo t
  join public.clientes cl on cl.id = t.cliente_id
  left join lateral (
    select count(*) as numero
    from public.visitas v2
    where t.clase = 'visita'
      and v2.cliente_id = t.cliente_id
      and v2.negocio_id = v_negocio.id
      and v2.anulada_en is null
      and (v2.fecha, v2.id) <= (t.fecha, t.id)
  ) k on true;

  return jsonb_build_object('actividad', v_lista);
end;
$$;

revoke all on function public.actividad_reciente(integer) from public, anon, authenticated;
grant execute on function public.actividad_reciente(integer) to authenticated;


-- ═══ 5. grafica_regresos() ═══
-- Visitas de regreso de las últimas 4 semanas, en bloques de 7 días que
-- terminan hoy (el último bloque es hoy y los 6 días anteriores). Cada
-- semana lleva su día de inicio y de fin. suficiente = false con menos de
-- 7 días de datos (desde la primera visita válida).
create function public.grafica_regresos()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio public.negocios%rowtype;
  v_hoy date;
  v_base date;         -- primer día del primer bloque
  v_primer_dia date;
  v_dias integer;
  v_semanas jsonb;
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
  v_base := v_hoy - 27;

  select min(v.dia_local) into v_primer_dia
  from public.visitas v
  where v.negocio_id = v_negocio.id and v.cliente_id is not null and v.anulada_en is null;
  v_dias := case when v_primer_dia is null then 0 else v_hoy - v_primer_dia + 1 end;

  with regresos as (
    select v.dia_local
    from public.visitas v
    where v.negocio_id = v_negocio.id
      and v.cliente_id is not null
      and v.anulada_en is null
      and v.dia_local between v_base and v_hoy
      and exists (
        select 1 from public.visitas v2
        where v2.cliente_id = v.cliente_id
          and v2.negocio_id = v_negocio.id
          and v2.anulada_en is null
          and (v2.fecha, v2.id) < (v.fecha, v.id)
      )
  )
  select jsonb_agg(jsonb_build_object(
           'desde', s.ini,
           'hasta', s.ini + 6,
           'visitas_regreso', (select count(*) from regresos r where r.dia_local between s.ini and s.ini + 6)
         ) order by s.ini)
  into v_semanas
  from (select v_base + 7 * g as ini from generate_series(0, 3) as g) s;

  return jsonb_build_object(
    'suficiente', v_dias >= 7,
    'dias_de_datos', v_dias,
    'hoy', v_hoy,
    'total', (select coalesce(sum((e->>'visitas_regreso')::int), 0) from jsonb_array_elements(v_semanas) e),
    'semanas', v_semanas
  );
end;
$$;

revoke all on function public.grafica_regresos() from public, anon, authenticated;
grant execute on function public.grafica_regresos() to authenticated;


-- ═══ 6. Comprobaciones finales ═══
do $$
declare
  v_funcion text;
  v_antes text;
  v_despues text;
begin
  foreach v_funcion in array array[
    'public.resumen_inicio()',
    'public.resumen_periodo(text)',
    'public.clientes_cerca_premio()',
    'public.actividad_reciente(integer)',
    'public.grafica_regresos()'
  ] loop
    -- Security definer, search_path vacío y stable.
    if not exists (
      select 1 from pg_proc
      where oid = to_regprocedure(v_funcion)
        and prosecdef
        and provolatile = 's'
        and 'search_path=""' = any (proconfig)
    ) then
      raise exception '% debe ser security definer, stable y con search_path vacío.', v_funcion;
    end if;
    -- Sin visitas anuladas y con la comprobación del dueño.
    if position('anulada_en is null' in (select prosrc from pg_proc where oid = to_regprocedure(v_funcion))) = 0
       or position('user_has_business_role' in (select prosrc from pg_proc where oid = to_regprocedure(v_funcion))) = 0
       or position('NEGOCIO_INACTIVO' in (select prosrc from pg_proc where oid = to_regprocedure(v_funcion))) = 0 then
      raise exception '% debe ignorar anuladas y comprobar dueño y negocio activo.', v_funcion;
    end if;
    -- Solo con sesión.
    if has_function_privilege('anon', v_funcion, 'execute') then
      raise exception 'anon NO debe poder ejecutar %.', v_funcion;
    end if;
    if not has_function_privilege('authenticated', v_funcion, 'execute') then
      raise exception 'authenticated debe poder ejecutar %.', v_funcion;
    end if;
  end loop;

  -- Las funciones existentes quedaron idénticas: misma huella que al inicio
  -- y las 4 presentes.
  v_antes := nullif(current_setting('fase7.huellas', true), '');
  select string_agg(p.oid::regprocedure::text || ':' || md5(p.prosrc), ',' order by p.oid::regprocedure::text)
  into v_despues
  from pg_proc p
  where p.oid in (
    to_regprocedure('public.resumen_dueno()'),
    to_regprocedure('public.grafica_dueno(text)'),
    to_regprocedure('public.clientes_inactivos()'),
    to_regprocedure('public.resumen_meseros()')
  );
  if v_antes is null then
    raise exception 'No se encontró la huella inicial (fase7.huellas): correr el archivo completo de una vez.';
  end if;
  if v_despues is distinct from v_antes
     or array_length(string_to_array(v_antes, ','), 1) <> 4 then
    raise exception 'Se modificó una función existente del panel: este archivo solo agrega.';
  end if;
end;
$$;


commit;


-- ═══════════════════════════════════════════════════════════════════════
-- PRUEBAS (después de aplicar; un bloque a la vez; terminan en rollback)
-- ═══════════════════════════════════════════════════════════════════════
-- Usan un NEGOCIO DE PRUEBA (meta 3, ticket $100, creado hace 120 días):
-- "prestan" al primer dueño real moviendo su perfil a ese negocio solo
-- dentro de la prueba (el rollback lo regresa). Teléfonos +5299800008xx.
-- Cada bloque termina con un NOTICE "OK ..." o con ERROR "FALLÓ ...".
/*

-- ═══ PRUEBA 1: números con datos conocidos ═══
-- Datos (meta 3; "hace N días" = N días antes de hoy en la zona del negocio):
--   Ana:   visitas hace 20, 10 y 2 días. Puntos 2 (a 1 visita del premio).
--   Beto:  visita hace 1 día. Puntos 1.
--   Carla: visitas hace 5 y 3 días, y una HOY anulada. Puntos 2.
--   Dani:  visitas hace 30, 29 y 28 días; premio entregado hace 25 días. Puntos 0.
--   Pepe:  número del personal, sin visitas, puntos 2 (no debe salir cerca).
--   Otro negocio: Zoe, puntos 2, con visitas (no debe salir nunca).
-- Esperado: NOTICE "OK: fase 7 pasó las 22 comprobaciones".
begin;
with n as (
  insert into public.negocios (nombre, email, meta_puntos, premio, ticket_promedio, fecha_creacion)
  values ('Prueba Fase 7', 'prueba-fase-7@example.invalid', 3, 'Un café', 100, now() - interval '120 days')
  returning id
)
select set_config('prueba.negocio', id::text, true) from n;
with n as (
  insert into public.negocios (nombre, email, meta_puntos, premio)
  values ('Prueba Fase 7 ajeno', 'prueba-fase-7b@example.invalid', 3, 'Un café')
  returning id
)
select set_config('prueba.ajeno', id::text, true) from n;
select set_config('prueba.dueno', p.user_id::text, true)
from public.profiles p join public.negocios ne on ne.id = p.negocio_id
where p.role = 'owner' and p.activo and ne.activo is true order by p.created_at limit 1;
update public.profiles set negocio_id = current_setting('prueba.negocio')::uuid
where user_id = current_setting('prueba.dueno')::uuid;

with c as (
  insert into public.clientes (negocio_id, telefono, nombre, puntos_actuales, total_visitas)
  values (current_setting('prueba.negocio')::uuid, '+529980000801', 'Ana María', 2, 3),
         (current_setting('prueba.negocio')::uuid, '+529980000802', 'Beto',      1, 1),
         (current_setting('prueba.negocio')::uuid, '+529980000803', 'Carla',     2, 2),
         (current_setting('prueba.negocio')::uuid, '+529980000804', 'Dani',      0, 3),
         (current_setting('prueba.negocio')::uuid, '+529980000805', 'Pepe',      2, 0),
         (current_setting('prueba.ajeno')::uuid,   '+529980000899', 'Zoe',       2, 2)
  returning id, nombre
)
insert into public.visitas (cliente_id, negocio_id, fecha, origen, anulada_en, anulada_por, anulada_motivo)
select c.id, x.negocio, now() - x.hace, 'qr',
       case when x.anulada then now() end,
       case when x.anulada then current_setting('prueba.dueno')::uuid end,
       case when x.anulada then 'Prueba fase 7' end
from c join (values
  ('Ana María', current_setting('prueba.negocio')::uuid, interval '20 days', false),
  ('Ana María', current_setting('prueba.negocio')::uuid, interval '10 days', false),
  ('Ana María', current_setting('prueba.negocio')::uuid, interval '2 days',  false),
  ('Beto',      current_setting('prueba.negocio')::uuid, interval '1 day',   false),
  ('Carla',     current_setting('prueba.negocio')::uuid, interval '5 days',  false),
  ('Carla',     current_setting('prueba.negocio')::uuid, interval '3 days',  false),
  ('Carla',     current_setting('prueba.negocio')::uuid, interval '0',       true),
  ('Dani',      current_setting('prueba.negocio')::uuid, interval '30 days', false),
  ('Dani',      current_setting('prueba.negocio')::uuid, interval '29 days', false),
  ('Dani',      current_setting('prueba.negocio')::uuid, interval '28 days', false),
  ('Zoe',       current_setting('prueba.ajeno')::uuid,   interval '3 days',  false),
  ('Zoe',       current_setting('prueba.ajeno')::uuid,   interval '1 day',   false)
) as x(nombre, negocio, hace, anulada) on x.nombre = c.nombre;

insert into public.canjes (negocio_id, cliente_id, codigo, estado, creado_en, expira_en,
                           premio_texto, puntos_descontados, confirmado_por, confirmado_en)
select cl.negocio_id, cl.id, '0001', 'entregado', now() - interval '25 days',
       now() - interval '25 days' + interval '5 minutes', 'Un café', 3,
       current_setting('prueba.dueno')::uuid, now() - interval '25 days'
from public.clientes cl
where cl.negocio_id = current_setting('prueba.negocio')::uuid and cl.nombre = 'Dani';

insert into public.numeros_excluidos (negocio_id, telefono)
values (current_setting('prueba.negocio')::uuid, '+529980000805');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);

do $$
declare
  r jsonb;
  v_hoy date := (now() at time zone 'America/Cancun')::date;
  v_err text;
begin
  -- 1. resumen_inicio
  r := public.resumen_inicio();
  if (r->>'clientes_regresaron')::int <> 3 then raise exception 'FALLÓ 1a: clientes_regresaron esperaba 3: %', r; end if;
  if (r->>'visitas_regreso_total')::int <> 5 then raise exception 'FALLÓ 1b: visitas_regreso_total esperaba 5: %', r; end if;
  if (r->>'ventas_estimadas_total')::numeric <> 500 then raise exception 'FALLÓ 1c: ventas esperaba 500: %', r; end if;
  if (r->>'desde')::date <> v_hoy - 30 then raise exception 'FALLÓ 1d: desde esperaba %: %', v_hoy - 30, r; end if;
  if (r->>'clientes_registrados')::int <> 5 or (r->>'proximo_logro')::int <> 10 then raise exception 'FALLÓ 1e: registrados 5 y logro 10: %', r; end if;

  -- 2. resumen_periodo('semana'): actual = Beto y Carla nuevos; Ana (2 d) y
  --    Carla (3 d) regresos. Anterior = Ana (10 d) regreso. Sin premios.
  r := public.resumen_periodo('semana');
  if (r->'clientes_nuevos'->>'actual')::int <> 2 or (r->'clientes_nuevos'->>'anterior')::int <> 0 then raise exception 'FALLÓ 2a: nuevos: %', r; end if;
  if (r->'visitas_regreso'->>'actual')::int <> 2 or (r->'visitas_regreso'->>'anterior')::int <> 1 then raise exception 'FALLÓ 2b: regresos: %', r; end if;
  if (r->'premios_entregados'->>'actual')::int <> 0 or (r->'premios_entregados'->>'anterior')::int <> 0 then raise exception 'FALLÓ 2c: premios: %', r; end if;
  if (r->>'anterior_con_datos')::boolean is not true then raise exception 'FALLÓ 2d: anterior_con_datos debía ser true: %', r; end if;
  if (r->>'desde')::date <> v_hoy - 6 or (r->>'anterior_hasta')::date <> v_hoy - 7 then raise exception 'FALLÓ 2e: fechas: %', r; end if;

  -- 3. resumen_periodo('mes'): mismo número de días en los dos periodos
  --    (o el mes anterior completo si es más corto).
  r := public.resumen_periodo('mes');
  if (r->>'desde')::date <> date_trunc('month', v_hoy)::date
     or (r->>'anterior_desde')::date <> (date_trunc('month', v_hoy) - interval '1 month')::date
     or (r->>'anterior_hasta')::date >= (r->>'desde')::date
     or ((r->>'anterior_hasta')::date - (r->>'anterior_desde')::date) > ((r->>'hasta')::date - (r->>'desde')::date) then
    raise exception 'FALLÓ 3a: fechas del mes: %', r;
  end if;
  v_err := null;
  begin perform public.resumen_periodo('año'); exception when others then v_err := sqlerrm; end;
  if v_err is distinct from 'PERIODO_INVALIDO' then raise exception 'FALLÓ 3b: esperaba PERIODO_INVALIDO, salió %', coalesce(v_err, '(sin error)'); end if;

  -- 4. clientes_cerca_premio: Ana y Carla (no Pepe del personal ni Zoe ajena).
  r := public.clientes_cerca_premio();
  if (r->>'total')::int <> 2 or jsonb_array_length(r->'clientes') <> 2 then raise exception 'FALLÓ 4a: cerca esperaba 2: %', r; end if;
  if r->'clientes'->0->>'nombre' <> 'Ana' or r->'clientes'->0->>'ultimos4' <> '0801' then
    raise exception 'FALLÓ 4b: primero debía ser Ana ···0801 (solo primer nombre): %', r;
  end if;

  -- 5. actividad_reciente: Beto nuevo, Ana regreso n.º 3, Carla regreso n.º 2...
  r := public.actividad_reciente();
  if jsonb_array_length(r->'actividad') <> 5 then raise exception 'FALLÓ 5a: esperaba 5 filas: %', r; end if;
  if r->'actividad'->0->>'tipo' <> 'nuevo' or r->'actividad'->0->>'nombre' <> 'Beto' then raise exception 'FALLÓ 5b: %', r; end if;
  if r->'actividad'->1->>'tipo' <> 'regreso' or (r->'actividad'->1->>'numero')::int <> 3 then raise exception 'FALLÓ 5c: %', r; end if;
  -- 9 visitas válidas + 1 canje; el límite nunca pasa de 20.
  r := public.actividad_reciente(100);
  if jsonb_array_length(r->'actividad') <> 10
     or (select count(*) from jsonb_array_elements(r->'actividad') e where e->>'tipo' = 'canje') <> 1 then
    raise exception 'FALLÓ 5d: esperaba 10 filas con 1 canje: %', r;
  end if;

  -- 6. grafica_regresos: semanas [0, 0, 1, 2], suficiente.
  r := public.grafica_regresos();
  if (r->>'suficiente')::boolean is not true or jsonb_array_length(r->'semanas') <> 4 then raise exception 'FALLÓ 6a: %', r; end if;
  if (select array_agg((e->>'visitas_regreso')::int order by e->>'desde') from jsonb_array_elements(r->'semanas') e) <> array[0, 0, 1, 2] then
    raise exception 'FALLÓ 6b: semanas esperaba [0,0,1,2]: %', r;
  end if;
  if (r->'semanas'->3->>'hasta')::date <> v_hoy then raise exception 'FALLÓ 6c: la última semana debe terminar hoy: %', r; end if;

  -- 7. Ningún teléfono en ninguna respuesta.
  if concat(public.resumen_inicio(), public.resumen_periodo('semana'), public.resumen_periodo('mes'),
            public.clientes_cerca_premio(), public.actividad_reciente(20), public.grafica_regresos()) ~ '\+52|998000' then
    raise exception 'FALLÓ 7: alguna respuesta trae teléfonos.';
  end if;

  raise notice 'OK: fase 7 pasó las 22 comprobaciones';
end;
$$;
rollback;


-- ═══ PRUEBA 2: negocio recién creado, sin visitas ═══
-- Esperado: NOTICE "OK: negocio nuevo sin datos".
begin;
with n as (
  insert into public.negocios (nombre, email, meta_puntos, premio)
  values ('Prueba Fase 7 nuevo', 'prueba-fase-7c@example.invalid', 10, 'Un café')
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
do $$
declare
  r jsonb;
begin
  r := public.resumen_inicio();
  if (r->>'clientes_regresaron')::int <> 0 or r->>'desde' is not null
     or r->'ventas_estimadas_total' <> 'null'::jsonb or (r->>'proximo_logro')::int <> 10 then
    raise exception 'FALLÓ: resumen_inicio sin datos: %', r;
  end if;
  if (public.resumen_periodo('semana')->>'anterior_con_datos')::boolean
     or (public.resumen_periodo('mes')->>'anterior_con_datos')::boolean then
    raise exception 'FALLÓ: un negocio nuevo no tiene periodo anterior.';
  end if;
  if (public.grafica_regresos()->>'suficiente')::boolean then
    raise exception 'FALLÓ: la gráfica no debe ser suficiente sin datos.';
  end if;
  if jsonb_array_length(public.actividad_reciente()->'actividad') <> 0
     or (public.clientes_cerca_premio()->>'total')::int <> 0 then
    raise exception 'FALLÓ: actividad y cerca del premio deben venir vacías.';
  end if;
  raise notice 'OK: negocio nuevo sin datos';
end;
$$;
rollback;


-- ═══ PRUEBA 3: un mesero no puede leer el resumen ═══
-- (Necesita un perfil con rol "mesero".)
-- Esperado: ERROR: Acceso denegado
begin;
select set_config('prueba.mesero', p.user_id::text, true)
from public.profiles p where p.role = 'mesero' and p.activo order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.mesero'), 'role', 'authenticated')::text, true);
select public.resumen_inicio();
rollback;


-- ═══ PRUEBA 4: sin sesión ═══
-- Esperado: ERROR: permission denied for function clientes_cerca_premio
begin;
set local role anon;
select public.clientes_cerca_premio();
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
select public.actividad_reciente();
rollback;


-- ═══ PRUEBA 6: tu negocio real, a ojo ═══
-- Compara con lo que ves hoy en el panel (resumen_dueno sigue igual).
begin;
select set_config('prueba.dueno', p.user_id::text, true)
from public.profiles p join public.negocios ne on ne.id = p.negocio_id
where p.role = 'owner' and p.activo and ne.activo is true order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select public.resumen_inicio() as inicio,
       public.resumen_periodo('mes') as mes,
       public.resumen_periodo('semana') as semana,
       public.clientes_cerca_premio() as cerca,
       public.actividad_reciente() as actividad,
       public.grafica_regresos() as grafica,
       public.resumen_dueno() as resumen_actual;
rollback;

*/
