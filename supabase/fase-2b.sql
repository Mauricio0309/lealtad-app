-- Fase 2B: funciones RPC del mesero (crear, cancelar y listar códigos QR).
-- Todo va en UNA transacción: si cualquier paso falla, no se aplica nada.
-- Correr completo en el editor SQL de Supabase.
--
-- Errores que verá la app (en error.message):
--   'Acceso denegado'       sin sesión o sin rol de mesero/dueño
--   'NEGOCIO_INACTIVO'      el negocio está desactivado
--   'LIMITE_CODIGOS'        ya tiene el máximo de códigos activos
--   'CODIGO_NO_ENCONTRADO'  no existe o no es de quien cancela
--   'CODIGO_USADO' / 'CODIGO_CANCELADO' / 'CODIGO_CADUCADO'

begin;


-- ═══ 0. Comprobaciones previas ═══
do $$
begin
  if to_regclass('public.codigos') is null then
    raise exception 'Falta la fase 2A (no existe la tabla codigos).';
  end if;
  -- gen_random_bytes viene de pgcrypto (instalada en el esquema extensions).
  if to_regprocedure('extensions.gen_random_bytes(integer)') is null then
    raise exception 'No se encontró extensions.gen_random_bytes (pgcrypto).';
  end if;
end;
$$;


-- ═══ 1. crear_codigo() ═══
-- El mesero toca "Cobré una cuenta". Todo se decide aquí, nunca en el teléfono.
-- Activo = sin reclamar, sin cancelar y sin caducar.
create or replace function public.crear_codigo()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_negocio public.negocios%rowtype;
  v_activos integer;
  v_codigo public.codigos%rowtype;
begin
  -- Cada usuario pertenece a un solo negocio (profiles.user_id es la llave).
  select n.* into v_negocio
  from public.profiles p
  join public.negocios n on n.id = p.negocio_id
  where p.user_id = v_usuario;

  if v_negocio.id is null
     or not public.user_has_business_role(v_negocio.id, array['owner', 'mesero']) then
    raise exception 'Acceso denegado';
  end if;

  if v_negocio.activo is not true then
    raise exception 'NEGOCIO_INACTIVO';
  end if;

  -- Bloqueo por mesero hasta que termine la transacción. Si toca dos veces a la
  -- vez, la segunda llamada espera aquí y cuenta ya con el código de la primera,
  -- así nunca se pasa del límite. Meseros distintos no se esperan entre sí.
  perform pg_advisory_xact_lock(hashtextextended('sello.crear_codigo:' || v_usuario::text, 0));

  select count(*) into v_activos
  from public.codigos c
  where c.creado_por = v_usuario
    and c.reclamado_en is null
    and c.cancelado_en is null
    and c.expira_en > now();

  if v_activos >= v_negocio.max_codigos_activos then
    raise exception 'LIMITE_CODIGOS'
      using detail = format('%s de %s códigos activos', v_activos, v_negocio.max_codigos_activos);
  end if;

  -- 48 bytes aleatorios en base64 = exactamente 64 caracteres. Se cambian "+" y "/"
  -- por "-" y "_" para que el código vaya limpio en la URL (#/c/<codigo>).
  insert into public.codigos (negocio_id, codigo, origen, creado_por, expira_en)
  values (
    v_negocio.id,
    translate(encode(extensions.gen_random_bytes(48), 'base64'), '+/', '-_'),
    'mesero_pwa',
    v_usuario,
    now() + make_interval(mins => v_negocio.minutos_codigo)
  )
  returning * into v_codigo;

  return jsonb_build_object(
    'id', v_codigo.id,
    'codigo', v_codigo.codigo,
    'expira_en', v_codigo.expira_en,
    'activos', v_activos + 1,
    'max_activos', v_negocio.max_codigos_activos
  );
end;
$$;


-- ═══ 2. cancelar_codigo(id) ═══
-- Libera un lugar cuando el cliente no escaneó. Solo códigos propios y activos.
-- Un código ajeno responde igual que uno inexistente, para no revelar nada.
create or replace function public.cancelar_codigo(p_codigo_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_codigo public.codigos%rowtype;
  v_activos integer;
  v_max integer;
begin
  -- "for update" bloquea el código: si el cliente lo está reclamando en ese
  -- instante (2C), una de las dos operaciones espera a la otra.
  select c.* into v_codigo
  from public.codigos c
  where c.id = p_codigo_id
    and c.creado_por = v_usuario
  for update;

  if v_codigo.id is null
     or not public.user_has_business_role(v_codigo.negocio_id, array['owner', 'mesero']) then
    raise exception 'CODIGO_NO_ENCONTRADO';
  end if;

  if v_codigo.reclamado_en is not null then
    raise exception 'CODIGO_USADO';
  end if;
  if v_codigo.cancelado_en is not null then
    raise exception 'CODIGO_CANCELADO';
  end if;
  if v_codigo.expira_en <= now() then
    raise exception 'CODIGO_CADUCADO';
  end if;

  update public.codigos
  set cancelado_en = now()
  where id = v_codigo.id
  returning * into v_codigo;

  select count(*) into v_activos
  from public.codigos c
  where c.creado_por = v_usuario
    and c.reclamado_en is null
    and c.cancelado_en is null
    and c.expira_en > now();

  select n.max_codigos_activos into v_max
  from public.negocios n
  where n.id = v_codigo.negocio_id;

  return jsonb_build_object(
    'id', v_codigo.id,
    'cancelado_en', v_codigo.cancelado_en,
    'activos', v_activos,
    'max_activos', v_max
  );
end;
$$;


-- ═══ 3. mis_codigos_pendientes() ═══
-- Lista de la pantalla del mesero y el texto "2 de 3 activos".
-- Incluye el código para poder volver a mostrar el QR.
create or replace function public.mis_codigos_pendientes()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_negocio public.negocios%rowtype;
  v_codigos jsonb;
begin
  select n.* into v_negocio
  from public.profiles p
  join public.negocios n on n.id = p.negocio_id
  where p.user_id = v_usuario;

  if v_negocio.id is null
     or not public.user_has_business_role(v_negocio.id, array['owner', 'mesero']) then
    raise exception 'Acceso denegado';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id,
           'codigo', c.codigo,
           'creado_en', c.creado_en,
           'expira_en', c.expira_en
         ) order by c.creado_en desc), '[]'::jsonb)
  into v_codigos
  from public.codigos c
  where c.creado_por = v_usuario
    and c.reclamado_en is null
    and c.cancelado_en is null
    and c.expira_en > now();

  return jsonb_build_object(
    'codigos', v_codigos,
    'activos', jsonb_array_length(v_codigos),
    'max_activos', v_negocio.max_codigos_activos
  );
end;
$$;


-- ═══ 4. Permisos ═══
-- Supabase da permiso de ejecutar a todos por defecto. Se quita y se da
-- solo a usuarios con sesión; cada función revisa además el rol.
revoke all on function public.crear_codigo() from public, anon, authenticated;
revoke all on function public.cancelar_codigo(uuid) from public, anon, authenticated;
revoke all on function public.mis_codigos_pendientes() from public, anon, authenticated;

grant execute on function public.crear_codigo() to authenticated;
grant execute on function public.cancelar_codigo(uuid) to authenticated;
grant execute on function public.mis_codigos_pendientes() to authenticated;


commit;
