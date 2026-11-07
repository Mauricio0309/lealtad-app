-- Fase 2C: funciones RPC del cliente (ver el código, reclamar el punto y ver la tarjeta).
-- Las llama el celular del cliente SIN sesión (rol anon).
-- Todo va en UNA transacción: si cualquier paso falla, no se aplica nada.
-- Correr completo en el editor SQL de Supabase.
--
-- Errores que verá la app (en error.message):
--   'CODIGO_INVALIDO'    no existe o tiene un formato imposible
--   'CODIGO_USADO' / 'CODIGO_CANCELADO' / 'CODIGO_CADUCADO'
--   'NEGOCIO_INACTIVO'   el negocio está desactivado
--   'TELEFONO_INVALIDO'  no es un número de México de 10 dígitos
--   'NOMBRE_INVALIDO'    cliente nuevo sin un primer nombre utilizable
--   'NUMERO_EXCLUIDO'    número del personal: no gana puntos
--   'YA_SUMO_HOY'        llegó al límite de visitas del día
--   'TOKEN_INVALIDO'     el teléfono recordado ya no sirve (pedir el número)
-- En todos estos errores la transacción se revierte: el código NO se gasta
-- y no se crea ningún cliente.
--
-- Token del teléfono recordado: 32 bytes aleatorios (43 caracteres) que genera
-- el servidor. En la base solo se guarda su SHA-256; el token en claro solo
-- existe en la respuesta de reclamar_codigo y en el celular del cliente.

begin;


-- ═══ 0. Comprobaciones previas ═══
do $$
begin
  if to_regclass('public.dispositivos_cliente') is null
     or to_regprocedure('public.normalizar_telefono_mx(text)') is null then
    raise exception 'Falta la fase 2A.';
  end if;
  if to_regprocedure('extensions.gen_random_bytes(integer)') is null then
    raise exception 'No se encontró extensions.gen_random_bytes (pgcrypto).';
  end if;
  if to_regprocedure('public.public_get_business(uuid)') is null then
    raise exception 'Falta public_get_business (fase 3).';
  end if;
end;
$$;


-- ═══ 1. ver_codigo(codigo, token) ═══
-- Lo primero que llama la página #/c/<codigo>. Solo lee, nunca suma.
-- Un código inexistente o de un negocio desactivado responde 'invalido',
-- sin datos del negocio, para no revelar nada.
create or replace function public.ver_codigo(p_codigo text, p_token text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_codigo public.codigos%rowtype;
  v_negocio jsonb;
  v_cliente public.clientes%rowtype;
begin
  if p_codigo is null or p_codigo !~ '^[A-Za-z0-9_-]{32,64}$' then
    return jsonb_build_object('estado', 'invalido');
  end if;

  select c.* into v_codigo
  from public.codigos c
  where c.codigo = p_codigo;

  -- public_get_business devuelve null si el negocio está desactivado.
  if v_codigo.id is not null then
    v_negocio := public.public_get_business(v_codigo.negocio_id);
  end if;

  if v_negocio is null then
    return jsonb_build_object('estado', 'invalido');
  end if;

  -- Si el celular recuerda a un cliente de ESTE negocio: "¿Eres Ana ···4821?".
  if p_token is not null and length(p_token) between 32 and 128 then
    select cl.* into v_cliente
    from public.dispositivos_cliente d
    join public.clientes cl on cl.id = d.cliente_id
    where d.token_hash = sha256(convert_to(p_token, 'UTF8'))
      and cl.negocio_id = v_codigo.negocio_id;
  end if;

  return jsonb_build_object(
    'estado', case
      when v_codigo.reclamado_en is not null then 'usado'
      when v_codigo.cancelado_en is not null then 'cancelado'
      when v_codigo.expira_en <= now() then 'caducado'
      else 'valido'
    end,
    'negocio', v_negocio,
    'cliente', case
      when v_cliente.id is null then null
      else jsonb_build_object(
        'nombre', coalesce(v_cliente.nombre, 'Cliente'),
        'ultimos4', right(v_cliente.telefono, 4)
      )
    end
  );
end;
$$;


-- ═══ 2. reclamar_codigo(codigo, token, teléfono, nombre) ═══
-- El cliente toca "Sumar" (con token) o manda su número y primer nombre.
-- Es la ÚNICA forma de crear clientes (junto con la captura manual de 2H).
-- Bloqueos para que nada se cuente dos veces:
--   - el código ("for update"): dos celulares con el mismo código → solo uno gana;
--   - el cliente ("for update"): dos códigos del mismo cliente a la vez → el
--     segundo espera, ve la visita del primero y responde YA_SUMO_HOY.
create or replace function public.reclamar_codigo(
  p_codigo text,
  p_token text default null,
  p_telefono text default null,
  p_nombre text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo public.codigos%rowtype;
  v_negocio public.negocios%rowtype;
  v_cliente public.clientes%rowtype;
  v_cliente_id uuid;
  v_dispositivo_id uuid;
  v_telefono text;
  v_nombre text;
  v_meta integer;
  v_visitas_hoy integer;
  v_visita_id uuid;
  v_token text;
begin
  -- 2.1 El código: existe, sigue activo y su negocio está activo.
  if p_codigo is null or p_codigo !~ '^[A-Za-z0-9_-]{32,64}$' then
    raise exception 'CODIGO_INVALIDO';
  end if;

  select c.* into v_codigo
  from public.codigos c
  where c.codigo = p_codigo
  for update;

  if v_codigo.id is null then
    raise exception 'CODIGO_INVALIDO';
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

  select n.* into v_negocio
  from public.negocios n
  where n.id = v_codigo.negocio_id;

  if v_negocio.activo is not true then
    raise exception 'NEGOCIO_INACTIVO';
  end if;

  v_meta := coalesce(v_negocio.meta_puntos, 10);

  -- 2.2 ¿Quién reclama? Primero el token (cliente que regresa y tocó "Sumar").
  -- Si no hay token, no sirve o es de otro negocio, se usa el teléfono escrito.
  if p_token is not null and length(p_token) between 32 and 128 then
    select d.id, d.cliente_id into v_dispositivo_id, v_cliente_id
    from public.dispositivos_cliente d
    join public.clientes cl on cl.id = d.cliente_id
    where d.token_hash = sha256(convert_to(p_token, 'UTF8'))
      and cl.negocio_id = v_negocio.id;
  end if;

  if v_cliente_id is not null then
    select cl.telefono into v_telefono
    from public.clientes cl
    where cl.id = v_cliente_id;
  else
    v_telefono := public.normalizar_telefono_mx(p_telefono);
    if v_telefono is null then
      raise exception 'TELEFONO_INVALIDO';
    end if;
  end if;

  -- 2.3 Números del personal: no ganan puntos. Aplica también con token, por si
  -- el dueño agregó el número después de que el cliente se registró.
  if exists (
    select 1 from public.numeros_excluidos e
    where e.negocio_id = v_negocio.id and e.telefono = v_telefono
  ) then
    raise exception 'NUMERO_EXCLUIDO';
  end if;

  -- 2.4 Buscar o crear al cliente. Si ya existe, el nombre escrito se ignora:
  -- el mesero ve el nombre real y compara con quien tiene enfrente.
  if v_cliente_id is null then
    select cl.id into v_cliente_id
    from public.clientes cl
    where cl.negocio_id = v_negocio.id and cl.telefono = v_telefono;
  end if;

  if v_cliente_id is null then
    -- Solo el primer nombre: primera palabra, sin números ni símbolos, máx. 30
    -- letras, con mayúscula inicial. "  ana maría " → "Ana".
    v_nombre := split_part(btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g')), ' ', 1);
    v_nombre := left(regexp_replace(v_nombre, '[^A-Za-zÀ-ÖØ-öø-ÿ''-]', '', 'g'), 30);
    if v_nombre !~ '[A-Za-zÀ-ÖØ-öø-ÿ]' then
      raise exception 'NOMBRE_INVALIDO';
    end if;
    v_nombre := upper(left(v_nombre, 1)) || substr(v_nombre, 2);

    -- "on conflict": si otro reclamo creó este mismo número en ese instante,
    -- no falla; se toma el cliente que ya quedó creado.
    insert into public.clientes (negocio_id, telefono, nombre, puntos_actuales, total_visitas)
    values (v_negocio.id, v_telefono, v_nombre, 0, 0)
    on conflict (negocio_id, telefono) do nothing
    returning id into v_cliente_id;

    if v_cliente_id is null then
      select cl.id into v_cliente_id
      from public.clientes cl
      where cl.negocio_id = v_negocio.id and cl.telefono = v_telefono;
    end if;
  end if;

  -- 2.5 Bloquear al cliente y revisar el límite del día, en la zona del negocio.
  select cl.* into v_cliente
  from public.clientes cl
  where cl.id = v_cliente_id
  for update;

  select count(*) into v_visitas_hoy
  from public.visitas v
  where v.cliente_id = v_cliente.id
    and v.dia_local = (now() at time zone v_negocio.zona_horaria)::date;

  if v_visitas_hoy >= v_negocio.limite_visitas_dia then
    raise exception 'YA_SUMO_HOY';
  end if;

  -- 2.6 Sumar: visita, puntos y código reclamado con los datos del aviso.
  -- dia_local lo llena el trigger de la fase 2A.
  insert into public.visitas (cliente_id, negocio_id, puntos_sumados, origen, mesero_id, codigo_id)
  values (v_cliente.id, v_negocio.id, 1, 'qr', v_codigo.creado_por, v_codigo.id)
  returning id into v_visita_id;

  update public.clientes
  set puntos_actuales = coalesce(puntos_actuales, 0) + 1,
      total_visitas = coalesce(total_visitas, 0) + 1
  where id = v_cliente.id
  returning * into v_cliente;

  update public.codigos
  set reclamado_en = now(),
      cliente_id = v_cliente.id,
      visita_id = v_visita_id,
      aviso_nombre = coalesce(v_cliente.nombre, 'Cliente'),
      aviso_ultimos4 = right(v_cliente.telefono, 4),
      aviso_puntos = v_cliente.puntos_actuales,
      aviso_meta = v_meta,
      aviso_premio_listo = v_cliente.puntos_actuales >= v_meta
  where id = v_codigo.id;

  -- 2.7 Token nuevo para recordar el teléfono. Si llegó con token, se reemplaza
  -- el anterior (el viejo deja de servir); si no, se registra este celular.
  v_token := translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_');

  if v_dispositivo_id is not null then
    update public.dispositivos_cliente
    set token_hash = sha256(convert_to(v_token, 'UTF8')),
        ultimo_uso = now()
    where id = v_dispositivo_id;
  else
    insert into public.dispositivos_cliente (cliente_id, token_hash)
    values (v_cliente.id, sha256(convert_to(v_token, 'UTF8')));
  end if;

  return jsonb_build_object(
    'token', v_token,
    'negocio_id', v_negocio.id,
    'nombre', coalesce(v_cliente.nombre, 'Cliente'),
    'ultimos4', right(v_cliente.telefono, 4),
    'puntos', v_cliente.puntos_actuales,
    'meta', v_meta,
    'premio', v_negocio.premio,
    'premio_listo', v_cliente.puntos_actuales >= v_meta
  );
end;
$$;


-- ═══ 3. tarjeta_por_token(token) ═══
-- Reemplaza la tarjeta por teléfono: el número ya no va en la URL.
-- Nunca devuelve el teléfono completo, solo los últimos 4 dígitos.
create or replace function public.tarjeta_por_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cliente public.clientes%rowtype;
  v_negocio public.negocios%rowtype;
  v_meta integer;
begin
  if p_token is null or length(p_token) not between 32 and 128 then
    raise exception 'TOKEN_INVALIDO';
  end if;

  select cl.* into v_cliente
  from public.dispositivos_cliente d
  join public.clientes cl on cl.id = d.cliente_id
  where d.token_hash = sha256(convert_to(p_token, 'UTF8'));

  if v_cliente.id is null then
    raise exception 'TOKEN_INVALIDO';
  end if;

  select n.* into v_negocio
  from public.negocios n
  where n.id = v_cliente.negocio_id;

  if v_negocio.activo is not true then
    raise exception 'NEGOCIO_INACTIVO';
  end if;

  v_meta := coalesce(v_negocio.meta_puntos, 10);

  return jsonb_build_object(
    'negocio', public.public_get_business(v_negocio.id),
    'nombre', coalesce(v_cliente.nombre, 'Cliente'),
    'ultimos4', right(v_cliente.telefono, 4),
    'puntos', coalesce(v_cliente.puntos_actuales, 0),
    'meta', v_meta,
    'premio', v_negocio.premio,
    'premio_listo', coalesce(v_cliente.puntos_actuales, 0) >= v_meta,
    'visitas', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', h.fecha) order by h.fecha desc)
      from (
        select v.fecha
        from public.visitas v
        where v.cliente_id = v_cliente.id
        order by v.fecha desc
        limit 8
      ) h
    ), '[]'::jsonb)
  );
end;
$$;


-- ═══ 4. Permisos ═══
-- Las llama el cliente sin sesión: ejecutar para anon y authenticated, nadie más.
-- Las tablas siguen cerradas para anon; estas funciones son la única puerta.
revoke all on function public.ver_codigo(text, text) from public, anon, authenticated;
revoke all on function public.reclamar_codigo(text, text, text, text) from public, anon, authenticated;
revoke all on function public.tarjeta_por_token(text) from public, anon, authenticated;

grant execute on function public.ver_codigo(text, text) to anon, authenticated;
grant execute on function public.reclamar_codigo(text, text, text, text) to anon, authenticated;
grant execute on function public.tarjeta_por_token(text) to anon, authenticated;


commit;
