-- Fase 5A: panel mínimo del administrador de Sello (alta de negocios piloto).
-- NO EJECUTADO. Para revisar. Requiere 4C (profiles.activo) y 4E (negocios.mensaje_gracias).
-- Todo va en UNA transacción: si cualquier paso o comprobación falla, no se aplica nada.
--
-- Qué hace:
--   1. Tabla admins (user_id): quién es administrador de Sello. RLS activada
--      y SIN políticas, y sin permisos para anon/authenticated: nadie la lee
--      ni la escribe con las llaves públicas. Solo service_role (Edge Function)
--      y las funciones de abajo.
--   2. es_admin(): ¿quien llama es administrador? La app la usa SOLO para
--      decidir si muestra #/admin. La seguridad real está en 3, 4 y 5.
--   3. admin_negocios(): lista de negocios con TOTALES (clientes registrados,
--      visitas de los últimos 7 días). Nunca nombres ni teléfonos de clientes.
--   4. admin_cambiar_activo(negocio, activo): desactiva o reactiva un negocio.
--      Al desactivar cancela sus códigos QR pendientes.
--   5. alta_negocio(usuario, nombre, correo, admin): solo service_role. La
--      llama la Edge Function crear-negocio DESPUÉS de crear la cuenta Auth
--      del dueño; inserta el negocio con valores por defecto y el perfil owner.
--      Vuelve a comprobar que quien pidió el alta esté en admins.
--
-- Errores (en error.message):
--   'Acceso denegado'        quien llama no es administrador
--   'NOMBRE_INVALIDO'        nombre vacío, de 1 letra o de más de 60
--   'CORREO_INVALIDO'        correo con formato inválido
--   'CORREO_EN_USO'          ya hay un negocio con ese correo
--   'YA_TIENE_PERFIL'        esa cuenta Auth ya pertenece a un negocio
--   'NEGOCIO_NO_ENCONTRADO'  el negocio no existe
--   'PETICION_INVALIDA'      faltan datos
--
-- ─────────────────────────────────────────────────────────────────────────
-- CÓMO DARTE DE ALTA COMO ADMINISTRADOR (a mano, DESPUÉS de aplicar esto):
--   1. Supabase → Authentication → Users → copia tu "User UID".
--      (o en el editor SQL:  select id, email from auth.users order by created_at;)
--   2. En el editor SQL:
--        insert into public.admins (user_id) values ('PEGA-AQUI-TU-USER-UID');
--   3. Comprueba:  select * from public.admins;
--   Para quitar a alguien:  delete from public.admins where user_id = '...';
-- ─────────────────────────────────────────────────────────────────────────

begin;


-- ═══ 0. Comprobaciones previas ═══
do $$
declare
  v_col text;
begin
  foreach v_col in array array[
    'negocios.email', 'negocios.activo', 'negocios.fecha_creacion', 'negocios.meta_puntos',
    'negocios.premio', 'negocios.zona_horaria', 'negocios.color_principal',
    'negocios.mensaje_gracias', 'profiles.activo', 'profiles.role', 'visitas.dia_local',
    'clientes.negocio_id', 'codigos.cancelado_en'
  ] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = split_part(v_col, '.', 1)
        and column_name = split_part(v_col, '.', 2)
    ) then
      raise exception 'Falta la columna public.% (revisa que 4C y 4E estén aplicadas).', v_col;
    end if;
  end loop;

  if to_regclass('public.admins') is not null then
    raise exception 'La tabla public.admins ya existe. Revisa antes de volver a correr este archivo.';
  end if;
end;
$$;


-- ═══ 1. Tabla admins ═══
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now()
);

comment on table public.admins is
  'Administradores de Sello. Se edita solo a mano desde el editor SQL. Sin acceso con llaves públicas.';

-- RLS activada y sin políticas = nadie pasa con anon/authenticated.
-- Además se quitan los permisos de tabla (Supabase los da por defecto a las
-- tablas nuevas de public): doble cerradura.
alter table public.admins enable row level security;
-- (Sin "force": las funciones de abajo, dueñas de la tabla, sí deben poder leerla.)
revoke all on table public.admins from public, anon, authenticated;
grant select on table public.admins to service_role;


-- ═══ 2. es_admin() ═══
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

revoke all on function public.es_admin() from public, anon, authenticated;
grant execute on function public.es_admin() to authenticated;


-- ═══ 3. admin_negocios() — lista con totales, solo administradores ═══
-- Por negocio: nombre, correo del negocio, activo, fecha de alta y conteos.
-- "Últimos 7 días" = hoy y los 6 días anteriores en la zona del negocio
-- (la misma regla que "esta semana" del panel del dueño).
create or replace function public.admin_negocios()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lista jsonb;
begin
  if not public.es_admin() then
    raise exception 'Acceso denegado';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id,
           'nombre', n.nombre,
           'correo', n.email,
           'activo', coalesce(n.activo, false),
           'creado_en', n.fecha_creacion at time zone 'UTC',
           'clientes', c.total,
           'visitas_7_dias', v.total
         ) order by n.fecha_creacion desc nulls last, n.nombre), '[]'::jsonb)
  into v_lista
  from public.negocios n
  cross join lateral (
    select count(*) as total from public.clientes cl where cl.negocio_id = n.id
  ) c
  cross join lateral (
    select count(*) as total
    from public.visitas vi
    where vi.negocio_id = n.id
      and vi.dia_local between (now() at time zone coalesce(n.zona_horaria, 'America/Cancun'))::date - 6
                           and (now() at time zone coalesce(n.zona_horaria, 'America/Cancun'))::date
  ) v;

  return jsonb_build_object('negocios', v_lista);
end;
$$;

revoke all on function public.admin_negocios() from public, anon, authenticated;
grant execute on function public.admin_negocios() to authenticated;


-- ═══ 4. admin_cambiar_activo(negocio, activo) — solo administradores ═══
-- No borra nada. Con activo = false el negocio deja de funcionar para su
-- dueño, sus meseros y sus clientes (login, códigos y reclamos ya revisan
-- negocios.activo). Sus códigos pendientes se cancelan.
create or replace function public.admin_cambiar_activo(p_negocio_id uuid, p_activo boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text;
  v_cancelados integer := 0;
begin
  if not public.es_admin() then
    raise exception 'Acceso denegado';
  end if;
  if p_negocio_id is null or p_activo is null then
    raise exception 'PETICION_INVALIDA';
  end if;

  update public.negocios n
  set activo = p_activo
  where n.id = p_negocio_id
  returning n.nombre into v_nombre;

  if not found then
    raise exception 'NEGOCIO_NO_ENCONTRADO';
  end if;

  if not p_activo then
    update public.codigos c
    set cancelado_en = now()
    where c.negocio_id = p_negocio_id
      and c.reclamado_en is null
      and c.cancelado_en is null
      and c.expira_en > now();
    get diagnostics v_cancelados = row_count;
  end if;

  return jsonb_build_object('id', p_negocio_id, 'nombre', v_nombre, 'activo', p_activo,
                            'codigos_cancelados', v_cancelados);
end;
$$;

revoke all on function public.admin_cambiar_activo(uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_cambiar_activo(uuid, boolean) to authenticated;


-- ═══ 5. alta_negocio(usuario, nombre, correo, admin) — solo service_role ═══
-- Valores por defecto del negocio nuevo (el dueño los cambia en su bienvenida):
--   meta 10 visitas, premio "Un café gratis" (plantilla), mensaje
--   "¡Gracias por tu visita!" (plantilla), zona America/Cancun, color verde
--   de Sello (#0a5c47, está en la paleta). Límites (códigos activos 3,
--   minutos 10, visitas al día 1, capturas manuales 10): los de la columna.
create or replace function public.alta_negocio(
  p_usuario_id uuid,
  p_nombre text,
  p_correo text,
  p_admin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text;
  v_correo text;
  v_negocio_id uuid;
begin
  -- Defensa en profundidad: la Edge Function ya lo revisó.
  if p_admin_id is null or not exists (select 1 from public.admins a where a.user_id = p_admin_id) then
    raise exception 'Acceso denegado';
  end if;
  if p_usuario_id is null then
    raise exception 'PETICION_INVALIDA';
  end if;

  -- Nombre: sin caracteres de control, espacios juntos, de 2 a 60.
  v_nombre := regexp_replace(coalesce(p_nombre, ''), '[[:cntrl:]]', '', 'g');
  v_nombre := btrim(regexp_replace(v_nombre, '\s+', ' ', 'g'));
  if length(v_nombre) < 2 or length(v_nombre) > 60 then
    raise exception 'NOMBRE_INVALIDO';
  end if;

  -- Correo: minúsculas, sin espacios, formato básico, máx. 254.
  v_correo := lower(btrim(coalesce(p_correo, '')));
  if length(v_correo) > 254 or v_correo !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' then
    raise exception 'CORREO_INVALIDO';
  end if;

  -- Un alta a la vez por correo.
  perform pg_advisory_xact_lock(hashtextextended('sello.alta_negocio:' || v_correo, 0));

  if exists (select 1 from public.negocios n where lower(n.email) = v_correo) then
    raise exception 'CORREO_EN_USO';
  end if;
  if exists (select 1 from public.profiles p where p.user_id = p_usuario_id) then
    raise exception 'YA_TIENE_PERFIL';
  end if;

  begin
    insert into public.negocios (nombre, email, activo, meta_puntos, premio, zona_horaria,
                                 color_principal, mensaje_gracias)
    values (v_nombre, v_correo, true, 10, 'Un café gratis', 'America/Cancun',
            '#0a5c47', '¡Gracias por tu visita!')
    returning id into v_negocio_id;
  exception when unique_violation then
    raise exception 'CORREO_EN_USO';
  end;

  insert into public.profiles (user_id, negocio_id, role, activo)
  values (p_usuario_id, v_negocio_id, 'owner', true);

  return jsonb_build_object('negocio_id', v_negocio_id, 'nombre', v_nombre, 'correo', v_correo);
end;
$$;

revoke all on function public.alta_negocio(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.alta_negocio(uuid, text, text, uuid) to service_role;


-- ═══ 6. Comprobaciones finales ═══
do $$
declare
  v_funcion text;
begin
  -- admins: RLS activada, sin políticas, sin permisos públicos.
  if not exists (select 1 from pg_class where oid = 'public.admins'::regclass and relrowsecurity) then
    raise exception 'admins debe tener RLS activada.';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'admins') then
    raise exception 'admins NO debe tener políticas.';
  end if;
  if has_table_privilege('anon', 'public.admins', 'select, insert, update, delete, truncate, references, trigger')
     or has_table_privilege('authenticated', 'public.admins', 'select, insert, update, delete, truncate, references, trigger') then
    raise exception 'anon y authenticated NO deben tener permisos sobre admins.';
  end if;
  if exists (select 1 from public.admins) then
    raise exception 'admins debe quedar vacía al aplicar este archivo (te agregas a mano después).';
  end if;

  -- Funciones: security definer y search_path vacío; anon no ejecuta ninguna.
  foreach v_funcion in array array[
    'public.es_admin()',
    'public.admin_negocios()',
    'public.admin_cambiar_activo(uuid, boolean)',
    'public.alta_negocio(uuid, text, text, uuid)'
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
  end loop;

  if has_function_privilege('authenticated', 'public.alta_negocio(uuid, text, text, uuid)', 'execute') then
    raise exception 'Solo service_role puede ejecutar alta_negocio.';
  end if;
  if not has_function_privilege('service_role', 'public.alta_negocio(uuid, text, text, uuid)', 'execute') then
    raise exception 'service_role debe poder ejecutar alta_negocio.';
  end if;
  if not has_function_privilege('authenticated', 'public.es_admin()', 'execute')
     or not has_function_privilege('authenticated', 'public.admin_negocios()', 'execute')
     or not has_function_privilege('authenticated', 'public.admin_cambiar_activo(uuid, boolean)', 'execute') then
    raise exception 'authenticated debe poder ejecutar es_admin, admin_negocios y admin_cambiar_activo.';
  end if;

  -- Ningún dueño puede reactivar (ni crear) su negocio por su cuenta.
  if has_column_privilege('authenticated', 'public.negocios', 'activo', 'update')
     or has_table_privilege('authenticated', 'public.negocios', 'insert') then
    raise exception 'authenticated NO debe poder cambiar negocios.activo ni insertar negocios.';
  end if;
  if has_table_privilege('authenticated', 'public.profiles', 'insert, update, delete') then
    raise exception 'authenticated no debe escribir directo en profiles.';
  end if;
end;
$$;


commit;


-- ═══════════════════════════════════════════════════════════════════════
-- PRUEBAS (después de aplicar; un bloque a la vez; todas terminan en rollback)
-- Ninguna deja datos: los admins y negocios de prueba se deshacen.
-- ═══════════════════════════════════════════════════════════════════════
/*

-- ═══ PRUEBA 1: nadie lee admins con llaves públicas ═══
-- Esperado: ERROR: permission denied for table admins
begin;
set local role anon;
select * from public.admins;
rollback;

begin;
set local role authenticated;
select * from public.admins;
rollback;


-- ═══ PRUEBA 2: un dueño cualquiera NO es admin ═══
-- Esperado: es_admin = false; luego ERROR: Acceso denegado
begin;
select set_config('prueba.dueno', p.user_id::text, true)
from public.profiles p where p.role = 'owner' order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select public.es_admin();
select public.admin_negocios();
rollback;


-- ═══ PRUEBA 3: un admin ve la lista con totales y SIN datos de clientes ═══
-- Esperado: es_admin = true; la lista; y "tiene_datos_de_clientes" = false.
begin;
select set_config('prueba.yo', p.user_id::text, true)
from public.profiles p where p.role = 'owner' order by p.created_at limit 1;
insert into public.admins (user_id) values (current_setting('prueba.yo')::uuid);
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.yo'), 'role', 'authenticated')::text, true);
select public.es_admin();
select jsonb_pretty(public.admin_negocios());
select public.admin_negocios()::text ~* '(telefono|\+52[0-9]{10}|puntos_actuales)' as tiene_datos_de_clientes;
rollback;


-- ═══ PRUEBA 4: un admin desactiva y reactiva un negocio ═══
-- Esperado: activo false (y códigos cancelados), luego activo true.
begin;
select set_config('prueba.yo', p.user_id::text, true)
from public.profiles p where p.role = 'owner' order by p.created_at limit 1;
select set_config('prueba.negocio', n.id::text, true)
from public.negocios n order by n.fecha_creacion limit 1;
insert into public.admins (user_id) values (current_setting('prueba.yo')::uuid);
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.yo'), 'role', 'authenticated')::text, true);
select public.admin_cambiar_activo(current_setting('prueba.negocio')::uuid, false);
select public.admin_cambiar_activo(current_setting('prueba.negocio')::uuid, true);
rollback;


-- ═══ PRUEBA 5: un dueño NO puede desactivar/activar negocios ═══
-- Esperado: ERROR: Acceso denegado
begin;
select set_config('prueba.dueno', p.user_id::text, true),
       set_config('prueba.negocio', p.negocio_id::text, true)
from public.profiles p where p.role = 'owner' order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select public.admin_cambiar_activo(current_setting('prueba.negocio')::uuid, true);
rollback;


-- ═══ PRUEBA 6: authenticated NO puede usar alta_negocio ═══
-- Esperado: ERROR: permission denied for function alta_negocio
begin;
set local role authenticated;
select public.alta_negocio(gen_random_uuid(), 'Café Prueba', 'prueba@correo.com', gen_random_uuid());
rollback;


-- ═══ PRUEBA 7: alta completa (como la Edge Function) ═══
-- Crea una cuenta Auth de prueba, un admin de prueba y el negocio.
-- Esperado: {"negocio_id": ..., "nombre": "Café Prueba", "correo": "piloto.prueba@example.com"}
--           y una fila de negocio con meta 10, premio de plantilla, America/Cancun, #0a5c47
--           y su perfil owner activo.
begin;
select set_config('prueba.yo', p.user_id::text, true)
from public.profiles p where p.role = 'owner' order by p.created_at limit 1;
insert into public.admins (user_id) values (current_setting('prueba.yo')::uuid);
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000005a1', 'piloto.prueba@example.com');
set local role service_role;
select public.alta_negocio('00000000-0000-4000-8000-0000000005a1', '  Café   Prueba ', 'Piloto.Prueba@Example.com ', current_setting('prueba.yo')::uuid);
reset role;
select n.nombre, n.email, n.activo, n.meta_puntos, n.premio, n.zona_horaria, n.color_principal,
       n.max_codigos_activos, n.limite_visitas_dia, n.mensaje_gracias, p.role, p.activo
from public.negocios n join public.profiles p on p.negocio_id = n.id
where p.user_id = '00000000-0000-4000-8000-0000000005a1';
rollback;


-- ═══ PRUEBA 8: errores de validación ═══
-- Ejecuta UNA línea "select public.alta_negocio(...)" a la vez (cada error aborta la transacción).
-- Esperados, en orden: Acceso denegado · NOMBRE_INVALIDO · CORREO_INVALIDO · CORREO_EN_USO
begin;
select set_config('prueba.yo', p.user_id::text, true)
from public.profiles p where p.role = 'owner' order by p.created_at limit 1;
insert into public.admins (user_id) values (current_setting('prueba.yo')::uuid);
set local role service_role;
-- select public.alta_negocio(gen_random_uuid(), 'Café Prueba', 'a@example.com', gen_random_uuid());
-- select public.alta_negocio(gen_random_uuid(), 'X', 'a@example.com', current_setting('prueba.yo')::uuid);
-- select public.alta_negocio(gen_random_uuid(), 'Café Prueba', 'no-es-correo', current_setting('prueba.yo')::uuid);
-- select public.alta_negocio(gen_random_uuid(), 'Café Prueba', (select email from public.negocios limit 1), current_setting('prueba.yo')::uuid);
rollback;

*/
