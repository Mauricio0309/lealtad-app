-- ═══════════════════════════════════════════════════════════════════════
-- Fase 9: ajustes del panel del dueño y del admin
-- ═══════════════════════════════════════════════════════════════════════
-- NO APLICADO. Para revisar antes de correrlo.
--
-- Qué agrega:
--   1. negocios.telefono_dueno       WhatsApp del dueño (opcional, E.164).
--      + fijar_telefono_dueno()      lo llena la Edge Function al crear el negocio.
--      + guardar_telefono_dueno()    el dueño lo edita en su panel.
--      + mi_telefono_dueno()         el dueño lo lee (los meseros no).
--      + admin_guardar_telefono_dueno()  el admin lo corrige.
--   2. grafica_clientes(p_dias)      clientes registrados acumulados por día.
--   3. admin_logros()                logros por negocio y los más recientes.
-- Qué cambia (única excepción a "solo agrega", pedida):
--   4. guardar_tarjeta()             valida el FORMATO del color (^#[0-9a-f]{6}$)
--                                    en vez de una lista fija de 8 colores.
--
-- ── Por qué una columna nueva para el teléfono del dueño ──
-- Ya existe negocios.telefono, pero es de la app vieja: no tiene formato ni
-- validación, alta_negocio no la llena, la API no la deja leer y no dice si
-- es el teléfono del local o el WhatsApp del dueño. telefono_dueno deja claro
-- para qué es (que el equipo de Sello felicite al dueño por WhatsApp) y
-- siempre está en E.164. negocios.telefono no se toca. Al final hay un bloque
-- opcional (comentado) para copiar los que ya sean válidos.
--
-- ── Cómo se llena y se edita (la UI se construye después de aprobar) ──
--   Alta (admin → "Crear negocio"): campo opcional "WhatsApp del dueño".
--     La Edge Function crear-negocio, después de alta_negocio, llama
--     fijar_telefono_dueno(negocio, telefono, admin) con la llave de servicio.
--     Si el número no es válido, el negocio se crea igual y se avisa.
--   Después:
--     - el dueño: Personalización → "Tu WhatsApp" con guardar_telefono_dueno;
--     - el admin: en la lista de negocios con admin_guardar_telefono_dueno.
--   Formato: se acepta "998 123 4567", "+52 1 998..." o "+529981234567";
--   México se normaliza con normalizar_telefono_mx (fase 2A); otro país debe
--   venir completo con "+" y su lada.
--
-- ── grafica_clientes ──
-- Cuenta lo mismo que resumen_inicio().clientes_registrados: todas las filas
-- de clientes del negocio. (Ojo: resumen_inicio NO quita los números
-- excluidos del personal; para que el último total sea igual a
-- clientes_registrados, aquí tampoco se quitan.)
-- Día de cada cliente: clientes.fecha_registro (timestamp sin zona, guardado
-- en UTC) llevado a la zona del negocio (America/Cancun si no tiene). Si no
-- tiene fecha, su primera visita; si tampoco, el primer día de la gráfica.
-- Además devuelve "alta": el día de alta del negocio (fecha_creacion, en su
-- zona), para "desde que empezaste · 1 de octubre" en el Resumen; hoy la app
-- no puede leer fecha_creacion (la API no da permiso a esa columna).
--
-- Errores:
--   'Acceso denegado'     sin sesión, no es dueño/admin o cuenta desactivada
--   'NEGOCIO_INACTIVO'    el negocio está desactivado
--   'DIAS_INVALIDOS'      p_dias fuera de 1..3650
--   'TELEFONO_INVALIDO'   no es un número válido
--   'NEGOCIO_NO_EXISTE'   (admin) negocio inexistente
--   'COLOR_INVALIDO'      color que no es #rrggbb

begin;


-- ═══ 0. Comprobaciones previas ═══
do $$
declare
  v_funcion text;
begin
  foreach v_funcion in array array[
    'public.user_has_business_role(uuid, text[])',
    'public.resumen_inicio()',
    'public.es_admin()',
    'public.normalizar_telefono_mx(text)',
    'public.guardar_tarjeta(text, text, text)'
  ] loop
    if to_regprocedure(v_funcion) is null then
      raise exception 'Falta % (revisar qué fase no se ha aplicado).', v_funcion;
    end if;
  end loop;
  if to_regclass('public.logros_celebrados') is null then
    raise exception 'Falta logros_celebrados (fase 8).';
  end if;
  if to_regclass('public.admins') is null then
    raise exception 'Falta admins (fase 5A).';
  end if;

  foreach v_funcion in array array[
    'public.grafica_clientes(integer)',
    'public.admin_logros()',
    'public.fijar_telefono_dueno(uuid, text, uuid)',
    'public.guardar_telefono_dueno(text)',
    'public.mi_telefono_dueno()',
    'public.admin_guardar_telefono_dueno(uuid, text)',
    'public.normalizar_telefono_dueno(text)'
  ] loop
    if to_regprocedure(v_funcion) is not null then
      raise exception '% ya existe: este archivo solo agrega funciones nuevas.', v_funcion;
    end if;
  end loop;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'negocios' and column_name = 'telefono_dueno') then
    raise exception 'negocios.telefono_dueno ya existe.';
  end if;

  -- Columnas que se leen.
  if (select count(*) from information_schema.columns
      where table_schema = 'public' and (table_name, column_name) in (
        ('negocios', 'zona_horaria'), ('negocios', 'fecha_creacion'), ('negocios', 'activo'),
        ('clientes', 'fecha_registro'), ('visitas', 'fecha')
      )) <> 5 then
    raise exception 'Faltan columnas (zona_horaria, fecha_creacion, fecha_registro o visitas.fecha).';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'clientes'
                   and column_name = 'fecha_registro' and data_type = 'timestamp without time zone') then
    raise exception 'clientes.fecha_registro cambió de tipo: revisar la conversión a hora local.';
  end if;
  -- negocios.fecha_creacion: "timestamp sin zona" guardado en UTC (igual que en
  -- la fase 7). Si pasara a timestamptz, "alta" sería (fecha_creacion at time zone v_tz)::date.
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'negocios'
                   and column_name = 'fecha_creacion' and data_type = 'timestamp without time zone') then
    raise exception 'negocios.fecha_creacion cambió de tipo: revisar la conversión de "alta" antes de aplicar.';
  end if;
  if current_setting('TimeZone') not in ('UTC', 'Etc/UTC') then
    raise exception 'La base no está en UTC (%): revisar cómo se guardaron fecha_registro y fecha_creacion.', current_setting('TimeZone');
  end if;

  -- guardar_tarjeta debe ser la versión de la fase 4E (lista fija de 8 colores).
  if position('''#1f2937'', ''#0a5c47''' in (select prosrc from pg_proc where oid = to_regprocedure('public.guardar_tarjeta(text, text, text)'))) = 0 then
    raise exception 'guardar_tarjeta no es la versión esperada (fase 4E): revisar antes de reemplazarla.';
  end if;
end;
$$;

-- Huella de resumen_inicio: este archivo no la toca.
select set_config('fase9.huella', (
  select md5(prosrc) from pg_proc where oid = to_regprocedure('public.resumen_inicio()')
), true);


-- ═══ 1. WhatsApp del dueño ═══
alter table public.negocios
  add column telefono_dueno text,
  add constraint negocios_telefono_dueno_e164 check (telefono_dueno is null or telefono_dueno ~ '^\+[1-9][0-9]{7,14}$');

comment on column public.negocios.telefono_dueno is
  'WhatsApp del dueño en E.164. Solo para que Sello lo contacte. Se escribe con las RPC de la fase 9.';

-- Sin permiso de columna para authenticated: los meseros (que pueden leer su
-- negocio) no lo ven. El dueño lo lee con mi_telefono_dueno().
revoke select (telefono_dueno), update (telefono_dueno) on public.negocios from anon, authenticated;

-- Normaliza: México con normalizar_telefono_mx; con "+" y otra lada, E.164
-- genérico. Vacío → null (quitarlo). Inválido → 'TELEFONO_INVALIDO'.
create function public.normalizar_telefono_dueno(p_telefono text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_texto text := btrim(coalesce(p_telefono, ''));
  v_digitos text := regexp_replace(v_texto, '\D', '', 'g');
  v_mx text;
begin
  if v_texto = '' then
    return null;
  end if;
  v_mx := public.normalizar_telefono_mx(v_texto);
  if v_mx is not null then
    return v_mx;
  end if;
  if left(v_texto, 1) = '+' and ('+' || v_digitos) ~ '^\+[1-9][0-9]{7,14}$' and v_digitos !~ '^52' then
    return '+' || v_digitos;
  end if;
  raise exception 'TELEFONO_INVALIDO';
end;
$$;

revoke all on function public.normalizar_telefono_dueno(text) from public, anon, authenticated;

-- Alta: lo llama la Edge Function crear-negocio (llave de servicio).
create function public.fijar_telefono_dueno(p_negocio_id uuid, p_telefono text, p_admin_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tel text;
begin
  if p_admin_id is null or not exists (select 1 from public.admins a where a.user_id = p_admin_id) then
    raise exception 'Acceso denegado';
  end if;
  v_tel := public.normalizar_telefono_dueno(p_telefono);
  update public.negocios set telefono_dueno = v_tel where id = p_negocio_id;
  if not found then
    raise exception 'NEGOCIO_NO_EXISTE';
  end if;
  return jsonb_build_object('telefono_dueno', v_tel);
end;
$$;

revoke all on function public.fijar_telefono_dueno(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.fijar_telefono_dueno(uuid, text, uuid) to service_role;

-- El dueño lo edita (vacío = quitarlo).
create function public.guardar_telefono_dueno(p_telefono text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio public.negocios%rowtype;
  v_tel text;
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

  v_tel := public.normalizar_telefono_dueno(p_telefono);
  update public.negocios set telefono_dueno = v_tel where id = v_negocio.id;
  return jsonb_build_object('telefono_dueno', v_tel);
end;
$$;

revoke all on function public.guardar_telefono_dueno(text) from public, anon, authenticated;
grant execute on function public.guardar_telefono_dueno(text) to authenticated;

-- El dueño lo lee.
create function public.mi_telefono_dueno()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio public.negocios%rowtype;
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
  return jsonb_build_object('telefono_dueno', v_negocio.telefono_dueno);
end;
$$;

revoke all on function public.mi_telefono_dueno() from public, anon, authenticated;
grant execute on function public.mi_telefono_dueno() to authenticated;

-- El admin lo corrige.
create function public.admin_guardar_telefono_dueno(p_negocio_id uuid, p_telefono text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tel text;
begin
  if not public.es_admin() then
    raise exception 'Acceso denegado';
  end if;
  v_tel := public.normalizar_telefono_dueno(p_telefono);
  update public.negocios set telefono_dueno = v_tel where id = p_negocio_id;
  if not found then
    raise exception 'NEGOCIO_NO_EXISTE';
  end if;
  return jsonb_build_object('negocio_id', p_negocio_id, 'telefono_dueno', v_tel);
end;
$$;

revoke all on function public.admin_guardar_telefono_dueno(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_guardar_telefono_dueno(uuid, text) to authenticated;


-- ═══ 2. grafica_clientes(p_dias) ═══
-- p_dias null = desde el primer cliente; si no, los últimos p_dias días
-- (o menos, si el primer cliente es más reciente). Cada punto es el total
-- ACUMULADO de clientes registrados hasta ese día (incluido). Máximo 365
-- puntos: con más días se agrupa por semana (o en pasos mayores, si hiciera
-- falta), siempre terminando HOY, así el último total = clientes_registrados.
-- {
--   "puntos": [{"fecha": "2026-10-01", "total": 3}, ...]   (más antiguo primero)
--   "total":  42,
--   "por":    "dia" | "semana" | "N dias",
--   "alta":   "2026-09-28"   (día de alta del negocio, en su zona)
-- }
create function public.grafica_clientes(p_dias integer default null)
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
  v_total bigint;
  v_primero date;
  v_inicio date;
  v_dias integer;
  v_paso integer;
  v_puntos jsonb;
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
  if p_dias is not null and (p_dias < 1 or p_dias > 3650) then
    raise exception 'DIAS_INVALIDOS';
  end if;

  v_tz  := coalesce(nullif(v_negocio.zona_horaria, ''), 'America/Cancun');
  v_hoy := (now() at time zone v_tz)::date;

  -- El mismo conteo que resumen_inicio().clientes_registrados.
  select count(*) into v_total from public.clientes cl where cl.negocio_id = v_negocio.id;

  if v_total = 0 then
    return jsonb_build_object(
      'puntos', '[]'::jsonb, 'total', 0, 'por', 'dia',
      'alta', ((v_negocio.fecha_creacion at time zone 'UTC') at time zone v_tz)::date
    );
  end if;

  with crudo as (
    select coalesce(
             ((cl.fecha_registro at time zone 'UTC') at time zone v_tz)::date,
             (select (min(v.fecha) at time zone v_tz)::date
              from public.visitas v
              where v.cliente_id = cl.id and v.negocio_id = v_negocio.id)
           ) as dia
    from public.clientes cl
    where cl.negocio_id = v_negocio.id
  )
  select min(least(c.dia, v_hoy)) into v_primero from crudo c where c.dia is not null;
  v_primero := coalesce(v_primero, v_hoy);

  v_inicio := case when p_dias is null then v_primero else greatest(v_primero, v_hoy - (p_dias - 1)) end;
  v_dias   := v_hoy - v_inicio + 1;
  v_paso   := case when v_dias > 365 then greatest(7, ceil(v_dias / 365.0)::integer) else 1 end;

  with crudo as (
    select coalesce(
             ((cl.fecha_registro at time zone 'UTC') at time zone v_tz)::date,
             (select (min(v.fecha) at time zone v_tz)::date
              from public.visitas v
              where v.cliente_id = cl.id and v.negocio_id = v_negocio.id)
           ) as dia
    from public.clientes cl
    where cl.negocio_id = v_negocio.id
  ),
  altas as (
    -- Sin fecha: cuenta desde el primer día. Fechas futuras (reloj): hoy.
    select least(coalesce(c.dia, v_primero), v_hoy) as dia from crudo c
  ),
  fechas as (
    -- De hoy hacia atrás en pasos de v_paso días; v_inicio siempre aparece.
    select g::date as fecha
    from generate_series(v_hoy::timestamp, v_inicio::timestamp, make_interval(days => -v_paso)) g
    union
    select v_inicio
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'fecha', f.fecha,
           'total', (select count(*) from altas a where a.dia <= f.fecha)
         ) order by f.fecha), '[]'::jsonb)
  into v_puntos
  from fechas f;

  return jsonb_build_object(
    'puntos', v_puntos,
    'total', v_total,
    'por', case v_paso when 1 then 'dia' when 7 then 'semana' else v_paso || ' dias' end,
    'alta', ((v_negocio.fecha_creacion at time zone 'UTC') at time zone v_tz)::date
  );
end;
$$;

revoke all on function public.grafica_clientes(integer) from public, anon, authenticated;
grant execute on function public.grafica_clientes(integer) to authenticated;


-- ═══ 3. admin_logros() ═══
-- Solo administradores. Nunca datos de clientes; el teléfono que sale es el
-- del DUEÑO (para felicitarlo por WhatsApp).
-- {
--   "negocios":  [{negocio_id, nombre, cantidad, ultimo_tipo, ultimo_hito, ultimo_en}]
--                todos los negocios (cantidad 0 y últimos null si no tiene),
--                con logros recientes primero.
--   "recientes": [{negocio_id, negocio, tipo, hito, celebrado_en, telefono_dueno, principal}]
--                más nuevo primero, máx. 50. celebrar_logro marca de una vez el
--                hito y los menores que faltaban: "principal" = true en el mayor
--                de ese momento, para que la app pueda mostrar solo ese.
-- }
create function public.admin_logros()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocios jsonb;
  v_recientes jsonb;
begin
  if not public.es_admin() then
    raise exception 'Acceso denegado';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'negocio_id', n.id,
           'nombre', n.nombre,
           'cantidad', coalesce(c.cantidad, 0),
           'ultimo_tipo', u.tipo,
           'ultimo_hito', u.hito,
           'ultimo_en', u.celebrado_en
         ) order by u.celebrado_en desc nulls last, n.nombre), '[]'::jsonb)
  into v_negocios
  from public.negocios n
  left join lateral (
    select count(*) as cantidad from public.logros_celebrados lc where lc.negocio_id = n.id
  ) c on true
  left join lateral (
    select lc.tipo, lc.hito, lc.celebrado_en
    from public.logros_celebrados lc
    where lc.negocio_id = n.id
    order by lc.celebrado_en desc, lc.hito desc
    limit 1
  ) u on true;

  select coalesce(jsonb_agg(jsonb_build_object(
           'negocio_id', r.negocio_id,
           'negocio', r.nombre,
           'tipo', r.tipo,
           'hito', r.hito,
           'celebrado_en', r.celebrado_en,
           'telefono_dueno', r.telefono_dueno,
           'principal', r.principal
         ) order by r.celebrado_en desc, r.hito desc), '[]'::jsonb)
  into v_recientes
  from (
    select lc.negocio_id, n.nombre, lc.tipo, lc.hito, lc.celebrado_en, n.telefono_dueno,
           lc.hito = max(lc.hito) over (partition by lc.negocio_id, lc.tipo, lc.celebrado_en) as principal
    from public.logros_celebrados lc
    join public.negocios n on n.id = lc.negocio_id
    order by lc.celebrado_en desc, lc.hito desc
    limit 50
  ) r;

  return jsonb_build_object('negocios', v_negocios, 'recientes', v_recientes);
end;
$$;

revoke all on function public.admin_logros() from public, anon, authenticated;
grant execute on function public.admin_logros() to authenticated;


-- ═══ 4. guardar_tarjeta(): color por formato ═══
-- Antes: solo 8 colores fijos (o el que ya tenía el negocio). Ahora la app
-- ofrece 12 colores y "Color libre", así que el servidor valida el formato
-- #rrggbb. El contraste lo resuelve la app (texto oscuro si el color es claro).
-- Si un día el color libre es solo de Pro, la regla del plan va aquí.
-- Mismo nombre, parámetros y respuesta: la app no cambia.
create or replace function public.guardar_tarjeta(
  p_color text,
  p_logo_ruta text default null,
  p_mensaje text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio public.negocios%rowtype;
  v_color text := lower(btrim(coalesce(p_color, '')));
  v_ruta text := nullif(btrim(coalesce(p_logo_ruta, '')), '');
  v_mensaje text;
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

  if v_color !~ '^#[0-9a-f]{6}$' then
    raise exception 'COLOR_INVALIDO';
  end if;

  -- El logo: un archivo que EXISTE en el bucket, en la carpeta de este negocio,
  -- con extensión y tipo de imagen permitidos (nunca SVG).
  if v_ruta is not null and (
       v_ruta !~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(png|jpg|jpeg|webp)$'
       or split_part(v_ruta, '/', 1) <> v_negocio.id::text
       or not exists (
         select 1 from storage.objects o
         where o.bucket_id = 'logos'
           and o.name = v_ruta
           and coalesce(o.metadata->>'mimetype', '') in ('image/png', 'image/jpeg', 'image/webp')
       )
     ) then
    raise exception 'LOGO_INVALIDO';
  end if;

  -- Mensaje: sin caracteres de control y con espacios normales.
  v_mensaje := regexp_replace(coalesce(p_mensaje, ''), '[[:cntrl:]]', ' ', 'g');
  v_mensaje := nullif(btrim(regexp_replace(v_mensaje, '\s+', ' ', 'g')), '');
  if v_mensaje is not null and length(v_mensaje) > 40 then
    raise exception 'MENSAJE_INVALIDO';
  end if;

  update public.negocios
  set color_principal = v_color,
      logo_ruta = v_ruta,
      mensaje_gracias = v_mensaje
  where id = v_negocio.id
  returning * into v_negocio;

  return jsonb_build_object(
    'color', v_negocio.color_principal,
    'logo', v_negocio.logo_ruta,
    'mensaje', v_negocio.mensaje_gracias
  );
end;
$$;

revoke all on function public.guardar_tarjeta(text, text, text) from public, anon, authenticated;
grant execute on function public.guardar_tarjeta(text, text, text) to authenticated;


-- ═══ 5. Verificación final (si algo falla, se deshace todo) ═══
do $$
declare
  v_funcion text;
begin
  foreach v_funcion in array array[
    'public.grafica_clientes(integer)',
    'public.admin_logros()',
    'public.guardar_telefono_dueno(text)',
    'public.mi_telefono_dueno()',
    'public.admin_guardar_telefono_dueno(uuid, text)',
    'public.guardar_tarjeta(text, text, text)'
  ] loop
    if not exists (
      select 1 from pg_proc
      where oid = to_regprocedure(v_funcion) and prosecdef and 'search_path=""' = any (proconfig)
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

  -- Solo la Edge Function (llave de servicio) llena el teléfono en el alta.
  if has_function_privilege('authenticated', 'public.fijar_telefono_dueno(uuid, text, uuid)', 'execute')
     or has_function_privilege('anon', 'public.fijar_telefono_dueno(uuid, text, uuid)', 'execute') then
    raise exception 'fijar_telefono_dueno debe ser solo de service_role.';
  end if;
  if has_function_privilege('authenticated', 'public.normalizar_telefono_dueno(text)', 'execute') then
    raise exception 'normalizar_telefono_dueno debe ser interna.';
  end if;

  -- Nadie lee ni escribe telefono_dueno directo por la API.
  if has_column_privilege('authenticated', 'public.negocios', 'telefono_dueno', 'select')
     or has_column_privilege('authenticated', 'public.negocios', 'telefono_dueno', 'update')
     or has_column_privilege('anon', 'public.negocios', 'telefono_dueno', 'select') then
    raise exception 'telefono_dueno no debe ser accesible directo por anon/authenticated.';
  end if;

  -- guardar_tarjeta ya valida por formato; resumen_inicio intacta.
  if position('^#[0-9a-f]{6}$' in (select prosrc from pg_proc where oid = to_regprocedure('public.guardar_tarjeta(text, text, text)'))) = 0 then
    raise exception 'guardar_tarjeta no quedó con la validación de formato.';
  end if;
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.resumen_inicio()'))
     is distinct from nullif(current_setting('fase9.huella', true), '') then
    raise exception 'Se modificó resumen_inicio() o falta la huella: correr el archivo completo de una vez.';
  end if;
end;
$$;


commit;


-- ═══ OPCIONAL (no corre): copiar los teléfonos viejos que ya sean válidos ═══
-- Revisar primero con el select; solo si son el WhatsApp del dueño.
-- select id, nombre, telefono, public.normalizar_telefono_mx(telefono) from public.negocios where telefono is not null and telefono <> '';
-- update public.negocios set telefono_dueno = public.normalizar_telefono_mx(telefono)
-- where telefono_dueno is null and public.normalizar_telefono_mx(telefono) is not null;


-- ═══════════════════════════════════════════════════════════════════════
-- PRUEBAS (después de aplicar; terminan en rollback, no dejan rastro)
-- ═══════════════════════════════════════════════════════════════════════
-- Usa el negocio real "dopamina" y su dueño, un mesero activo y el primer
-- admin. Todo en un solo DO (sin tablas temporales); cambia de rol con
-- set local. Esperado: NOTICE "OK: fase 9 pasó todas las pruebas".
/*

begin;
do $$
declare
  v_negocio constant uuid := '9f98217b-056b-419e-beeb-99315fd48a26';
  v_dueno uuid;
  v_mesero uuid;
  v_admin uuid;
  v_hoy date;
  v_registrados integer;
  r jsonb;
  v_err text;
  v_n integer;
  v_total_negocios integer;
  v_dueno_admin boolean;
begin
  select p.user_id into v_dueno from public.profiles p
  where p.negocio_id = v_negocio and p.role = 'owner' and p.activo order by p.created_at limit 1;
  if v_dueno is null then raise exception 'FALLÓ 0: dopamina no tiene dueño activo.'; end if;
  select p.user_id into v_mesero from public.profiles p
  where p.role = 'mesero' and p.activo order by (p.negocio_id = v_negocio) desc, p.created_at limit 1;
  select a.user_id into v_admin from public.admins a limit 1;
  select count(*) into v_total_negocios from public.negocios;   -- antes de cambiar de rol (RLS)
  -- admins está cerrada: se consulta antes de cambiar de rol.
  select exists (select 1 from public.admins a where a.user_id = v_dueno) into v_dueno_admin;
  select (now() at time zone coalesce(nullif(n.zona_horaria, ''), 'America/Cancun'))::date into v_hoy
  from public.negocios n where n.id = v_negocio;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_dueno, 'role', 'authenticated')::text, true);

  -- 1. Todo: el último total = clientes_registrados, termina hoy, sube o se
  --    queda igual, máx. 365 puntos, fechas en orden, sin teléfonos.
  v_registrados := (public.resumen_inicio()->>'clientes_registrados')::integer;
  r := public.grafica_clientes();
  v_n := jsonb_array_length(r->'puntos');
  if (r->>'total')::integer <> v_registrados then raise exception 'FALLÓ 1a: total % vs registrados %', r->>'total', v_registrados; end if;
  if v_registrados > 0 then
    if (r->'puntos'->(v_n - 1)->>'total')::integer <> v_registrados then raise exception 'FALLÓ 1b: último total no coincide: %', r->'puntos'->(v_n - 1); end if;
    if (r->'puntos'->(v_n - 1)->>'fecha')::date <> v_hoy then raise exception 'FALLÓ 1c: el último punto debe ser hoy: %', r->'puntos'->(v_n - 1); end if;
  end if;
  if v_n > 365 then raise exception 'FALLÓ 1d: % puntos (máx. 365)', v_n; end if;
  if exists (
    select 1 from jsonb_array_elements(r->'puntos') with ordinality a(p, i)
    join jsonb_array_elements(r->'puntos') with ordinality b(p, i) on b.i = a.i + 1
    where (b.p->>'fecha')::date <= (a.p->>'fecha')::date or (b.p->>'total')::integer < (a.p->>'total')::integer
  ) then raise exception 'FALLÓ 1e: fechas fuera de orden o total que baja.'; end if;
  if r::text ~ '\+[0-9]{8,}|nombre|telefono' then raise exception 'FALLÓ 1f: la gráfica trae datos de clientes.'; end if;
  raise notice '1 grafica_clientes() OK: % puntos, total %, por %, alta %', v_n, r->>'total', r->>'por', r->>'alta';

  -- 2. Últimos 30 días: máx. 30 puntos y el mismo total final.
  r := public.grafica_clientes(30);
  v_n := jsonb_array_length(r->'puntos');
  if v_n > 30 or (v_registrados > 0 and (r->'puntos'->(v_n - 1)->>'total')::integer <> v_registrados) then
    raise exception 'FALLÓ 2: 30 días: %', r;
  end if;
  v_err := null;
  begin perform public.grafica_clientes(0); exception when others then v_err := sqlerrm; end;
  if v_err is distinct from 'DIAS_INVALIDOS' then raise exception 'FALLÓ 2b: esperaba DIAS_INVALIDOS, salió %', coalesce(v_err, '(sin error)'); end if;

  -- 3. Teléfono del dueño: normaliza, rechaza basura y se puede quitar.
  r := public.guardar_telefono_dueno('998 123 4567');
  if r->>'telefono_dueno' <> '+529981234567' or public.mi_telefono_dueno()->>'telefono_dueno' <> '+529981234567' then
    raise exception 'FALLÓ 3a: %', r;
  end if;
  v_err := null;
  begin perform public.guardar_telefono_dueno('abc'); exception when others then v_err := sqlerrm; end;
  if v_err is distinct from 'TELEFONO_INVALIDO' then raise exception 'FALLÓ 3b: salió %', coalesce(v_err, '(sin error)'); end if;
  if public.guardar_telefono_dueno('')->>'telefono_dueno' is not null then raise exception 'FALLÓ 3c: vacío debía quitarlo.'; end if;
  v_err := null;
  begin perform count(telefono_dueno) from public.negocios; exception when insufficient_privilege then v_err := 'denegado'; end;
  if v_err is null then raise exception 'FALLÓ 3d: authenticated pudo leer telefono_dueno directo.'; end if;

  -- 4. guardar_tarjeta: acepta #rrggbb (en minúsculas) y rechaza otros formatos.
  r := public.guardar_tarjeta('#ABCDEF', null, null);
  if r->>'color' <> '#abcdef' then raise exception 'FALLÓ 4a: %', r; end if;
  foreach v_err in array array['abcdef', '#12345', '#12345g', 'rojo'] loop
    begin
      perform public.guardar_tarjeta(v_err, null, null);
      raise exception 'FALLÓ 4b: aceptó %', v_err;
    exception when others then
      if sqlerrm <> 'COLOR_INVALIDO' then raise; end if;
    end;
  end loop;

  -- 5. admin_logros: el dueño no entra (salvo que también sea admin).
  if v_dueno_admin then
    raise notice '5 OMITIDA: el dueño de dopamina también es admin';
  else
    v_err := null;
    begin perform public.admin_logros(); exception when others then v_err := sqlerrm; end;
    if v_err is distinct from 'Acceso denegado' then raise exception 'FALLÓ 5a: dueño en admin_logros salió %', coalesce(v_err, '(sin error)'); end if;
  end if;
  raise notice '2-5 30 días, errores, teléfono y color OK';

  -- 6. Mesero: sin gráfica ni teléfono.
  if v_mesero is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_mesero, 'role', 'authenticated')::text, true);
    v_err := null;
    begin perform public.grafica_clientes(); exception when others then v_err := sqlerrm; end;
    if v_err is distinct from 'Acceso denegado' then raise exception 'FALLÓ 6a: mesero en gráfica salió %', coalesce(v_err, '(sin error)'); end if;
    v_err := null;
    begin perform public.mi_telefono_dueno(); exception when others then v_err := sqlerrm; end;
    if v_err is distinct from 'Acceso denegado' then raise exception 'FALLÓ 6b: mesero en teléfono salió %', coalesce(v_err, '(sin error)'); end if;
    v_err := null;
    begin perform public.admin_logros(); exception when others then v_err := sqlerrm; end;
    if v_err is distinct from 'Acceso denegado' then raise exception 'FALLÓ 6c: mesero en admin_logros salió %', coalesce(v_err, '(sin error)'); end if;
  end if;

  -- 7. Admin: lista de todos los negocios y recientes en orden (máx. 50).
  if v_admin is null then
    raise notice '7 admin OMITIDA: no hay filas en admins';
  else
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    r := public.admin_logros();
    if jsonb_array_length(r->'negocios') <> v_total_negocios then raise exception 'FALLÓ 7a: faltan negocios.'; end if;
    if jsonb_array_length(r->'recientes') > 50 then raise exception 'FALLÓ 7b: más de 50 recientes.'; end if;
    if exists (
      select 1 from jsonb_array_elements(r->'recientes') with ordinality a(p, i)
      join jsonb_array_elements(r->'recientes') with ordinality b(p, i) on b.i = a.i + 1
      where (b.p->>'celebrado_en')::timestamptz > (a.p->>'celebrado_en')::timestamptz
    ) then raise exception 'FALLÓ 7c: recientes fuera de orden.'; end if;
    if r::text ~ '"(nombre_cliente|ultimos4|clientes)"\s*:' then raise exception 'FALLÓ 7d: trae datos de clientes.'; end if;
    v_err := null;
    begin r := public.admin_guardar_telefono_dueno(v_negocio, '+1 415 555 0100'); exception when others then v_err := sqlerrm; end;
    if v_err is not null then raise exception 'FALLÓ 7e: el admin no pudo guardar un número de EE. UU.: %', v_err; end if;
    if r->>'telefono_dueno' is distinct from '+14155550100' then
      raise exception 'FALLÓ 7f: el número de EE. UU. debía quedar +14155550100 (no confundirse con uno mexicano): %', r;
    end if;
    r := public.admin_logros();   -- para el NOTICE de abajo
    raise notice '6-7 mesero y admin OK (% negocios, % recientes)', jsonb_array_length(r->'negocios'), jsonb_array_length(r->'recientes');
  end if;

  -- 8. Anon: sin permiso.
  set local role anon;
  v_err := null;
  begin perform public.grafica_clientes(); exception when insufficient_privilege then v_err := 'denegado'; end;
  if v_err is null then raise exception 'FALLÓ 8a: anon ejecutó grafica_clientes.'; end if;
  v_err := null;
  begin perform public.admin_logros(); exception when insufficient_privilege then v_err := 'denegado'; end;
  if v_err is null then raise exception 'FALLÓ 8b: anon ejecutó admin_logros.'; end if;

  raise notice 'OK: fase 9 pasó todas las pruebas';
end;
$$;
rollback;

*/
