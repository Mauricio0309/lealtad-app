-- Fase 4C: el dueño da de alta a sus meseros (pestaña "Equipo").
-- NO EJECUTADO. Para revisar. Requiere la Fase 4 (profiles.nombre).
-- Todo va en UNA transacción: si cualquier paso falla, no se aplica nada.
--
-- Qué hace:
--   1. profiles.activo (verdadero por defecto). Un mesero desactivado:
--        - deja de pasar user_has_business_role → no puede generar códigos,
--          cancelarlos, capturar a mano, consultar ni confirmar canjes, ni leer
--          nada del negocio, AUNQUE tenga la sesión abierta (todas esas
--          funciones y políticas usan user_has_business_role);
--        - sus códigos pendientes se cancelan al desactivarlo (un cliente ya
--          no puede reclamar un QR que él generó);
--        - sus visitas históricas se conservan (no se borra nada).
--      Además, la Edge Function crear-mesero lo bloquea en Auth (no puede
--      volver a iniciar sesión ni renovar su sesión).
--   2. equipo_negocio(): la lista del equipo, solo para el dueño.
--   3. alta_mesero() y baja_mesero(): solo para la Edge Function (service_role).
--      El negocio lo decide la función a partir de la sesión del dueño; aquí
--      se vuelve a revisar todo y se bloquea por negocio para respetar el
--      máximo de 10 meseros activos aunque lleguen dos altas a la vez.
--
-- Errores (en error.message):
--   'Acceso denegado'    no es dueño
--   'NEGOCIO_INACTIVO'   el negocio está desactivado
--   'LIMITE_MESEROS'     ya hay 10 meseros activos
--   'NOMBRE_INVALIDO'    nombre vacío o de más de 30 caracteres
--   'YA_TIENE_PERFIL'    esa cuenta ya pertenece a un negocio
--   'MESERO_NO_ENCONTRADO'  no es un mesero de ese negocio

begin;


-- ═══ 0. Comprobaciones previas ═══
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'nombre'
  ) then
    raise exception 'Falta profiles.nombre (Fase 4).';
  end if;
  if to_regprocedure('public.user_has_business_role(uuid, text[])') is null then
    raise exception 'Falta user_has_business_role.';
  end if;
  if to_regclass('public.codigos') is null then
    raise exception 'Falta la tabla codigos (fase 2A).';
  end if;
end;
$$;


-- ═══ 1. profiles.activo ═══
alter table public.profiles
  add column if not exists activo boolean not null default true;

-- La revisión de rol que usan TODAS las funciones del mesero y del dueño y
-- las políticas de lectura: ahora exige además que la cuenta esté activa.
-- Misma firma, mismo resultado para todos los que ya existen (activo = true).
create or replace function public.user_has_business_role(p_business_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.negocio_id = p_business_id
      and p.role = any (p_roles)
      and p.activo
  );
$$;

revoke all on function public.user_has_business_role(uuid, text[]) from public, anon, authenticated;
grant execute on function public.user_has_business_role(uuid, text[]) to authenticated;


-- ═══ 2. equipo_negocio() — lista del equipo para el dueño ═══
-- Nombre, estado y fecha de alta de cada mesero. Sin correos ni teléfonos.
create or replace function public.equipo_negocio()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio public.negocios%rowtype;
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

  select coalesce(jsonb_agg(jsonb_build_object(
           'usuario_id', p.user_id,
           'nombre', coalesce(nullif(btrim(p.nombre), ''), 'Mesero'),
           'activo', p.activo,
           'creado_en', p.created_at
         ) order by p.activo desc, p.created_at), '[]'::jsonb)
  into v_lista
  from public.profiles p
  where p.negocio_id = v_negocio.id
    and p.role = 'mesero';

  return jsonb_build_object(
    'meseros', v_lista,
    'activos', (select count(*) from public.profiles p
                where p.negocio_id = v_negocio.id and p.role = 'mesero' and p.activo),
    'maximo', 10
  );
end;
$$;

revoke all on function public.equipo_negocio() from public, anon, authenticated;
grant execute on function public.equipo_negocio() to authenticated;


-- ═══ 3. alta_mesero(usuario, negocio, nombre) — solo service_role ═══
-- La llama la Edge Function DESPUÉS de crear la cuenta en Auth. Si falla,
-- la función borra esa cuenta. Solo crea rol "mesero", nunca "owner".
create or replace function public.alta_mesero(p_usuario_id uuid, p_negocio_id uuid, p_nombre text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text;
  v_activos integer;
begin
  -- Un alta a la vez por negocio: el conteo y el insert no se cruzan.
  perform pg_advisory_xact_lock(hashtextextended('sello.alta_mesero:' || p_negocio_id::text, 0));

  if not exists (select 1 from public.negocios n where n.id = p_negocio_id and n.activo is true) then
    raise exception 'NEGOCIO_INACTIVO';
  end if;

  v_nombre := btrim(regexp_replace(coalesce(p_nombre, ''), '[[:cntrl:]]', '', 'g'));
  v_nombre := regexp_replace(v_nombre, '\s+', ' ', 'g');
  if v_nombre = '' or length(v_nombre) > 30 then
    raise exception 'NOMBRE_INVALIDO';
  end if;

  if exists (select 1 from public.profiles p where p.user_id = p_usuario_id) then
    raise exception 'YA_TIENE_PERFIL';
  end if;

  select count(*) into v_activos
  from public.profiles p
  where p.negocio_id = p_negocio_id and p.role = 'mesero' and p.activo;

  if v_activos >= 10 then
    raise exception 'LIMITE_MESEROS';
  end if;

  insert into public.profiles (user_id, negocio_id, role, nombre, activo)
  values (p_usuario_id, p_negocio_id, 'mesero', v_nombre, true);

  return jsonb_build_object('usuario_id', p_usuario_id, 'nombre', v_nombre, 'activos', v_activos + 1);
end;
$$;


-- ═══ 4. baja_mesero(usuario, negocio) — solo service_role ═══
-- Marca al mesero como desactivado y cancela sus códigos pendientes.
-- No borra nada: sus visitas, códigos y canjes se quedan para el historial.
create or replace function public.baja_mesero(p_usuario_id uuid, p_negocio_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cancelados integer;
begin
  update public.profiles p
  set activo = false
  where p.user_id = p_usuario_id
    and p.negocio_id = p_negocio_id
    and p.role = 'mesero';

  if not found then
    raise exception 'MESERO_NO_ENCONTRADO';
  end if;

  update public.codigos c
  set cancelado_en = now()
  where c.creado_por = p_usuario_id
    and c.negocio_id = p_negocio_id
    and c.reclamado_en is null
    and c.cancelado_en is null
    and c.expira_en > now();
  get diagnostics v_cancelados = row_count;

  return jsonb_build_object('usuario_id', p_usuario_id, 'codigos_cancelados', v_cancelados);
end;
$$;

revoke all on function public.alta_mesero(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.baja_mesero(uuid, uuid) from public, anon, authenticated;
grant execute on function public.alta_mesero(uuid, uuid, text) to service_role;
grant execute on function public.baja_mesero(uuid, uuid) to service_role;


-- ═══ 5. Comprobaciones finales ═══
do $$
declare
  v_funcion text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'activo' and is_nullable = 'NO'
  ) then
    raise exception 'Falta profiles.activo (no nulo).';
  end if;
  if exists (select 1 from public.profiles where not activo) then
    raise exception 'Ningún perfil debería quedar desactivado al aplicar este archivo.';
  end if;
  if position('activo' in (select prosrc from pg_proc where oid = to_regprocedure('public.user_has_business_role(uuid, text[])'))) = 0 then
    raise exception 'user_has_business_role debe revisar profiles.activo.';
  end if;

  foreach v_funcion in array array[
    'public.user_has_business_role(uuid, text[])',
    'public.equipo_negocio()',
    'public.alta_mesero(uuid, uuid, text)',
    'public.baja_mesero(uuid, uuid)'
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

  if has_function_privilege('authenticated', 'public.alta_mesero(uuid, uuid, text)', 'execute')
     or has_function_privilege('authenticated', 'public.baja_mesero(uuid, uuid)', 'execute') then
    raise exception 'Solo service_role puede ejecutar alta_mesero y baja_mesero.';
  end if;
  if not has_function_privilege('service_role', 'public.alta_mesero(uuid, uuid, text)', 'execute')
     or not has_function_privilege('service_role', 'public.baja_mesero(uuid, uuid)', 'execute') then
    raise exception 'service_role debe poder ejecutar alta_mesero y baja_mesero.';
  end if;
  if not has_function_privilege('authenticated', 'public.equipo_negocio()', 'execute') then
    raise exception 'authenticated debe poder ejecutar equipo_negocio.';
  end if;

  -- El dueño y el mesero no pueden cambiar profiles directo (activo, rol, negocio).
  if has_table_privilege('authenticated', 'public.profiles', 'insert, update, delete') then
    raise exception 'authenticated no debe escribir directo en profiles.';
  end if;
end;
$$;


commit;


-- ═══════════════════════════════════════════════════════════════════════
-- PRUEBAS (después de aplicar; un bloque a la vez; terminan en rollback)
-- ═══════════════════════════════════════════════════════════════════════
/*

-- ═══ PRUEBA 1: el dueño ve su equipo ═══
-- Esperado: {"meseros": [...], "activos": N, "maximo": 10} (sin correos).
begin;
select set_config('prueba.dueno', p.user_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where p.role = 'owner' and n.activo is true order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select public.equipo_negocio();
rollback;


-- ═══ PRUEBA 2: un mesero desactivado no genera códigos aunque tenga sesión ═══
-- (Necesita un perfil con rol "mesero".)
-- Esperado: ERROR: Acceso denegado
begin;
select set_config('prueba.mesero', p.user_id::text, true),
       set_config('prueba.negocio', p.negocio_id::text, true)
from public.profiles p where p.role = 'mesero' order by p.created_at limit 1;
set local role service_role;
select public.baja_mesero(current_setting('prueba.mesero')::uuid, current_setting('prueba.negocio')::uuid);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.mesero'), 'role', 'authenticated')::text, true);
select public.crear_codigo();
rollback;


-- ═══ PRUEBA 4: el dueño no puede usar alta_mesero directo ═══
-- Esperado: ERROR: permission denied for function alta_mesero
begin;
set local role authenticated;
select public.alta_mesero(gen_random_uuid(), gen_random_uuid(), 'Ana');
rollback;


-- ═══ PRUEBA 5: una cuenta que ya es de un negocio no se puede volver a dar de alta ═══
-- Esperado: ERROR: YA_TIENE_PERFIL
begin;
select set_config('prueba.dueno', p.user_id::text, true),
       set_config('prueba.negocio', p.negocio_id::text, true)
from public.profiles p where p.role = 'owner' order by p.created_at limit 1;
set local role service_role;
select public.alta_mesero(current_setting('prueba.dueno')::uuid, current_setting('prueba.negocio')::uuid, 'Ana');
rollback;

*/
