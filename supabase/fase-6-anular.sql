-- Fase 6, paso 1: anular una visita (solo el dueño).
-- NO EJECUTADO. Para revisar. Solo SQL: la interfaz llega en el paso 2.
-- Requiere las fases 2A, 2C, 2H, 3 (canjes), 4, 4C, 4D y 5A.
-- Todo va en UNA transacción: si cualquier paso falla, no se aplica nada.
-- Las pruebas van al final, DESPUÉS del commit, comentadas: se copian y se
-- corren un bloque a la vez. Todas terminan en rollback.
--
-- Qué hace:
--   1. visitas.anulada_en, anulada_por y anulada_motivo. Una visita anulada
--      NO se borra: se queda en el historial con quién, cuándo y por qué.
--   2. anular_visita(visita, motivo)  solo el dueño de un negocio activo.
--      Resta el punto (y la visita) del contador del cliente.
--   3. Las visitas anuladas dejan de contar en:
--        - el límite diario del cliente: reclamar_codigo y visita_manual
--          (si el dueño anula la visita de hoy, el cliente puede volver a sumar);
--        - el panel: resumen_dueno, grafica_dueno, resumen_meseros,
--          clientes_inactivos y admin_negocios;
--        - el historial de la tarjeta del cliente: tarjeta_por_token;
--        - la página pública del negocio: public_get_landing ("visitas
--          registradas").
--      Cada función se reemplaza IDÉNTICA a su última versión, con un solo
--      cambio marcado "-- 6:" (and v.anulada_en is null).
--
-- Regla "la visita ya contribuyó a un premio canjeado":
--   Los puntos se gastan en orden (primero las visitas más viejas). Si el
--   cliente lleva canjeados P puntos en premios entregados, sus primeras P
--   visitas válidas (no anuladas, por fecha) son las que pagaron esos premios
--   y ya no se pueden anular. Además solo cuentan las visitas anteriores al
--   último premio entregado: una visita posterior nunca pagó un premio.
--   Ejemplo, meta 3: visitas V1 V2 V3 V4, premio entregado, luego V5.
--     V1, V2, V3 → rechazadas (pagaron el premio).
--     V4 → se puede anular (es el punto que le sobró: 4/3 → 1/3 → 0/3).
--     V5 → se puede anular.
--   Respaldo: si el contador del cliente ya no alcanza para restar el punto
--   (datos viejos que no cuadran), también se rechaza. Nunca queda negativo.
--
-- Lo que NO cambia (a propósito):
--   - El código QR de una visita anulada sigue "usado": no se puede volver a
--     reclamar. Si el cliente estaba presente, el mesero genera otro.
--   - El tope diario de capturas a mano del MESERO (max_manuales_dia) sigue
--     contando las capturas anuladas: es antifraude del mesero, no del cliente.
--   - "Códigos generados" del mesero no cambia; "reclamados" y "a mano" ya no
--     cuentan los anulados, y resumen_meseros agrega "anuladas" (visitas de
--     esa persona anuladas esta semana) para que el dueño no pierda la pista.
--     Es un campo nuevo: la app actual lo ignora.
--   - Un canje pendiente no se toca: si al anular ya no le alcanzan los
--     puntos, confirmar_canje lo rechaza con PUNTOS_INSUFICIENTES (Fase 3).
--
-- Errores que verá la app (en error.message):
--   'Acceso denegado'       sin sesión, no es dueño o su cuenta está desactivada
--   'NEGOCIO_INACTIVO'      el negocio está desactivado
--   'MOTIVO_INVALIDO'       motivo vacío o fuera de 3 a 200 caracteres
--   'VISITA_NO_ENCONTRADA'  no existe o es de otro negocio (responde igual)
--   'VISITA_YA_ANULADA'     ya estaba anulada
--   'VISITA_CANJEADA'       ya pagó un premio entregado (detail con el texto
--                           para el dueño)

begin;


-- ═══ 0. Comprobaciones previas ═══
do $$
declare
  v_funcion text;
begin
  foreach v_funcion in array array[
    'public.reclamar_codigo(text, text, text, text)',
    'public.tarjeta_por_token(text)',
    'public.visita_manual(text, text)',
    'public.resumen_dueno()',
    'public.clientes_inactivos()',
    'public.resumen_meseros()',
    'public.grafica_dueno(text)',
    'public.admin_negocios()',
    'public.public_get_landing(uuid)',
    'public.es_admin()',
    'public.user_has_business_role(uuid, text[])',
    'public.public_get_business(uuid)',
    'public.normalizar_telefono_mx(text)'
  ] loop
    if to_regprocedure(v_funcion) is null then
      raise exception 'Falta % (revisar qué fase no se ha aplicado).', v_funcion;
    end if;
  end loop;

  -- Se reemplaza la versión de la 4D (sin meseros desactivados), no la de la 4.
  if position('p.activo' in (select prosrc from pg_proc where oid = to_regprocedure('public.resumen_meseros()'))) = 0 then
    raise exception 'resumen_meseros no es la versión de la Fase 4D: aplicar fase-4d.sql antes.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'visitas'
      and column_name = 'fecha' and data_type = 'timestamp with time zone'
  ) then
    raise exception 'visitas.fecha debe ser timestamptz (fase 2A).';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'canjes' and column_name = 'confirmado_en'
  ) then
    raise exception 'Falta la Fase 3 (canjes con estado).';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'activo'
  ) then
    raise exception 'Falta profiles.activo (Fase 4C).';
  end if;
end;
$$;


-- ═══ 1. Columnas de anulación en visitas ═══
-- anulada_por: si se borra el usuario, la anulación se queda; solo se pierde
-- quién fue (igual que confirmado_por en canjes).
alter table public.visitas
  add column if not exists anulada_en timestamptz,
  add column if not exists anulada_por uuid references auth.users (id) on delete set null,
  add column if not exists anulada_motivo text;

alter table public.visitas
  -- Anulada siempre con motivo, y solo la anulada lleva motivo.
  drop constraint if exists visitas_anulada_con_motivo,
  add constraint visitas_anulada_con_motivo
    check ((anulada_en is null) = (anulada_motivo is null)),
  -- Una visita válida no tiene "quién la anuló".
  drop constraint if exists visitas_anulada_por_solo_si_anulada,
  add constraint visitas_anulada_por_solo_si_anulada
    check (anulada_en is not null or anulada_por is null),
  drop constraint if exists visitas_anulada_motivo_largo,
  add constraint visitas_anulada_motivo_largo
    check (anulada_motivo is null or length(anulada_motivo) between 3 and 200);

-- visitas tiene SELECT de tabla completa para authenticated (con la política
-- visitas_select_owner): el dueño ya puede leer las columnas nuevas.
-- Nadie las modifica directo: solo anular_visita.


-- ═══ 2. anular_visita(visita, motivo) ═══
-- Orden de bloqueos: cliente → visita. Las otras funciones bloquean
-- código → cliente (reclamar_codigo), mesero → cliente (visita_manual) y
-- canje → cliente (confirmar_canje); ninguna bloquea una visita existente,
-- así que no hay bloqueos cruzados. Bloquear al cliente hace que un reclamo
-- o un canje del mismo cliente espere y vea los puntos ya corregidos.
create or replace function public.anular_visita(p_visita_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_negocio public.negocios%rowtype;
  v_visita public.visitas%rowtype;
  v_cliente public.clientes%rowtype;
  v_motivo text;
  v_puntos integer;
  v_canjeados bigint;
  v_ultima_entrega timestamptz;
  v_posicion bigint;
begin
  -- 2.1 Solo el dueño, y solo de su negocio (sale de la sesión).
  select n.* into v_negocio
  from public.profiles p
  join public.negocios n on n.id = p.negocio_id
  where p.user_id = v_usuario and p.role = 'owner';

  if v_negocio.id is null
     or not public.user_has_business_role(v_negocio.id, array['owner']) then
    raise exception 'Acceso denegado';
  end if;
  if v_negocio.activo is not true then
    raise exception 'NEGOCIO_INACTIVO';
  end if;

  -- 2.2 Motivo obligatorio. Espacios repetidos se juntan.
  v_motivo := btrim(regexp_replace(coalesce(p_motivo, ''), '\s+', ' ', 'g'));
  if length(v_motivo) not between 3 and 200 then
    raise exception 'MOTIVO_INVALIDO';
  end if;

  -- 2.3 La visita, solo de SU negocio. Una ajena responde igual que una
  -- inexistente.
  select v.* into v_visita
  from public.visitas v
  where v.id = p_visita_id
    and v.negocio_id = v_negocio.id;

  if v_visita.id is null then
    raise exception 'VISITA_NO_ENCONTRADA';
  end if;

  -- 2.4 Bloquear al cliente y luego la visita; se vuelve a leer la visita
  -- ya bloqueada por si otra anulación ganó en ese instante.
  if v_visita.cliente_id is not null then
    select cl.* into v_cliente
    from public.clientes cl
    where cl.id = v_visita.cliente_id
    for update;
  end if;

  select v.* into v_visita
  from public.visitas v
  where v.id = v_visita.id
  for update;

  if v_visita.anulada_en is not null then
    raise exception 'VISITA_YA_ANULADA';
  end if;

  v_puntos := coalesce(v_visita.puntos_sumados, 1);

  -- 2.5 ¿Ya pagó un premio entregado? (regla explicada arriba del archivo)
  if v_cliente.id is not null then
    select coalesce(sum(c.puntos_descontados), 0), max(c.confirmado_en)
    into v_canjeados, v_ultima_entrega
    from public.canjes c
    where c.cliente_id = v_cliente.id
      and c.estado = 'entregado';

    if v_canjeados > 0 and v_visita.fecha <= v_ultima_entrega then
      -- Puntos acumulados por sus visitas válidas hasta esta (incluida).
      select coalesce(sum(coalesce(v.puntos_sumados, 1)), 0) into v_posicion
      from public.visitas v
      where v.cliente_id = v_cliente.id
        and v.anulada_en is null
        and (v.fecha, v.id) <= (v_visita.fecha, v_visita.id);

      if v_posicion - v_puntos < v_canjeados then
        raise exception 'VISITA_CANJEADA'
          using detail = 'Esta visita ya se usó para un premio entregado. No se puede anular.';
      end if;
    end if;

    -- Respaldo: nunca dejar puntos negativos.
    if coalesce(v_cliente.puntos_actuales, 0) < v_puntos then
      raise exception 'VISITA_CANJEADA'
        using detail = 'El cliente ya gastó este punto en un premio. No se puede anular.';
    end if;
  end if;

  -- 2.6 Marcar (nunca borrar) y corregir el contador del cliente.
  update public.visitas
  set anulada_en = now(),
      anulada_por = v_usuario,
      anulada_motivo = v_motivo
  where id = v_visita.id
  returning * into v_visita;

  if v_cliente.id is not null then
    update public.clientes
    set puntos_actuales = coalesce(puntos_actuales, 0) - v_puntos,
        total_visitas = greatest(coalesce(total_visitas, 0) - 1, 0)
    where id = v_cliente.id
    returning * into v_cliente;
  end if;

  return jsonb_build_object(
    'visita_id', v_visita.id,
    'anulada_en', v_visita.anulada_en,
    'motivo', v_visita.anulada_motivo,
    'nombre', case when v_cliente.id is null then null else coalesce(v_cliente.nombre, 'Cliente') end,
    'ultimos4', right(v_cliente.telefono, 4),
    'puntos', v_cliente.puntos_actuales,
    'meta', coalesce(v_negocio.meta_puntos, 10)
  );
end;
$$;

revoke all on function public.anular_visita(uuid, text) from public, anon, authenticated;
grant execute on function public.anular_visita(uuid, text) to authenticated;


-- ═══ 3. reclamar_codigo: el límite diario ignora visitas anuladas ═══
-- Idéntica a la de la Fase 2C salvo el paso 2.5.
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
    and v.dia_local = (now() at time zone v_negocio.zona_horaria)::date
    and v.anulada_en is null;  -- 6: las anuladas no cuentan en el límite

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

revoke all on function public.reclamar_codigo(text, text, text, text) from public, anon, authenticated;
grant execute on function public.reclamar_codigo(text, text, text, text) to anon, authenticated;


-- ═══ 4. tarjeta_por_token: el historial del cliente sin visitas anuladas ═══
-- Idéntica a la de la Fase 2C salvo el historial ('visitas'). Así la tarjeta
-- no muestra 8 visitas con 7 puntos.
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
          and v.anulada_en is null  -- 6: sin visitas anuladas
        order by v.fecha desc
        limit 8
      ) h
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.tarjeta_por_token(text) from public, anon, authenticated;
grant execute on function public.tarjeta_por_token(text) to anon, authenticated;


-- ═══ 5. visita_manual: el límite diario del cliente ignora anuladas ═══
-- Idéntica a la de la Fase 2H salvo el paso 2.6. El tope de capturas del
-- mesero (paso 2.2) sigue contando las anuladas (ver arriba del archivo).
create or replace function public.visita_manual(
  p_telefono text,
  p_nombre text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_negocio public.negocios%rowtype;
  v_cliente public.clientes%rowtype;
  v_cliente_id uuid;
  v_cliente_nuevo boolean := false;
  v_telefono text;
  v_nombre text;
  v_meta integer;
  v_hoy date;
  v_manuales_hoy integer;
  v_visitas_hoy integer;
begin
  -- 2.1 Quién llama: mesero o dueño de un negocio activo (sale de la sesión).
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

  v_meta := coalesce(v_negocio.meta_puntos, 10);
  v_hoy := (now() at time zone v_negocio.zona_horaria)::date;

  -- 2.2 Tope de capturas manuales del mesero hoy.
  -- Bloqueo por mesero (como en crear_codigo): si manda dos capturas a la vez,
  -- la segunda espera aquí y ya cuenta la primera; nunca se pasa del tope.
  -- Se toma ANTES de bloquear al cliente para que el orden de bloqueos sea
  -- siempre el mismo (mesero → cliente) y no haya bloqueos cruzados.
  perform pg_advisory_xact_lock(hashtextextended('sello.visita_manual:' || v_usuario::text, 0));

  if v_negocio.max_manuales_dia = 0 then
    raise exception 'LIMITE_MANUALES' using detail = 'desactivada';
  end if;

  select count(*) into v_manuales_hoy
  from public.visitas v
  where v.mesero_id = v_usuario
    and v.negocio_id = v_negocio.id
    and v.origen = 'manual'
    and v.dia_local = v_hoy;

  if v_manuales_hoy >= v_negocio.max_manuales_dia then
    raise exception 'LIMITE_MANUALES'
      using detail = format('%s de %s capturas hoy', v_manuales_hoy, v_negocio.max_manuales_dia);
  end if;

  -- 2.3 Teléfono en E.164.
  v_telefono := public.normalizar_telefono_mx(p_telefono);
  if v_telefono is null then
    raise exception 'TELEFONO_INVALIDO';
  end if;

  -- 2.4 Números del personal: no ganan puntos.
  if exists (
    select 1 from public.numeros_excluidos e
    where e.negocio_id = v_negocio.id and e.telefono = v_telefono
  ) then
    raise exception 'NUMERO_EXCLUIDO';
  end if;

  -- 2.5 Buscar o crear al cliente. Si ya existe, el nombre escrito se ignora:
  -- el mesero ve el nombre real y compara con quien tiene enfrente.
  select cl.id into v_cliente_id
  from public.clientes cl
  where cl.negocio_id = v_negocio.id and cl.telefono = v_telefono;

  if v_cliente_id is null then
    -- Misma limpieza que reclamar_codigo: primera palabra, sin números ni
    -- símbolos, máx. 30 letras, con mayúscula inicial. "  ana maría " → "Ana".
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
    else
      v_cliente_nuevo := true;
    end if;
  end if;

  -- 2.6 Bloquear al cliente y revisar su límite del día, en la zona del negocio.
  -- El mismo bloqueo que usa reclamar_codigo: un QR y una captura manual del
  -- mismo cliente a la vez no pueden sumar los dos.
  select cl.* into v_cliente
  from public.clientes cl
  where cl.id = v_cliente_id
  for update;

  select count(*) into v_visitas_hoy
  from public.visitas v
  where v.cliente_id = v_cliente.id
    and v.dia_local = v_hoy
    and v.anulada_en is null;  -- 6: las anuladas no cuentan en el límite

  if v_visitas_hoy >= v_negocio.limite_visitas_dia then
    raise exception 'YA_SUMO_HOY';
  end if;

  -- 2.7 Sumar: visita manual y puntos. dia_local lo llena el trigger de 2A.
  insert into public.visitas (cliente_id, negocio_id, puntos_sumados, origen, mesero_id)
  values (v_cliente.id, v_negocio.id, 1, 'manual', v_usuario);

  update public.clientes
  set puntos_actuales = coalesce(puntos_actuales, 0) + 1,
      total_visitas = coalesce(total_visitas, 0) + 1
  where id = v_cliente.id
  returning * into v_cliente;

  return jsonb_build_object(
    'nombre', coalesce(v_cliente.nombre, 'Cliente'),
    'ultimos4', right(v_cliente.telefono, 4),
    'puntos', v_cliente.puntos_actuales,
    'meta', v_meta,
    'premio_listo', v_cliente.puntos_actuales >= v_meta,
    'cliente_nuevo', v_cliente_nuevo
  );
end;
$$;

revoke all on function public.visita_manual(text, text) from public, anon, authenticated;
grant execute on function public.visita_manual(text, text) to authenticated;


-- ═══ 6. resumen_dueno: sin visitas anuladas ═══
-- Idéntica a la de la Fase 4 salvo el CTE "vis". "porcentaje_regresan" y
-- "premios_listos" salen de los contadores del cliente, que anular_visita
-- ya corrige.
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
      and v.anulada_en is null  -- 6: las anuladas no cuentan (ni para "primera visita")
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

revoke all on function public.resumen_dueno() from public, anon, authenticated;
grant execute on function public.resumen_dueno() to authenticated;


-- ═══ 7. clientes_inactivos: sin visitas anuladas ═══
-- Idéntica a la de la Fase 4 salvo el join. (Oculta en la app hasta
-- WhatsApp, pero se deja coherente para cuando vuelva.)
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
                         and v.anulada_en is null  -- 6: sin visitas anuladas
    where cl.negocio_id = v_negocio.id
    group by cl.id, cl.nombre, cl.telefono
    having max(v.dia_local) < v_hoy - 21
    order by max(v.dia_local) desc
    limit 300
  ) t;

  return jsonb_build_object('clientes', v_lista);
end;
$$;

revoke all on function public.clientes_inactivos() from public, anon, authenticated;
grant execute on function public.clientes_inactivos() to authenticated;


-- ═══ 8. resumen_meseros: sin visitas anuladas, más "anuladas" ═══
-- Idéntica a la de la Fase 4D salvo:
--   - "reclamados" no cuenta códigos cuya visita se anuló;
--   - "manuales" no cuenta capturas anuladas;
--   - campo nuevo "anuladas": visitas de esa persona (QR o a mano) de esta
--     semana que el dueño anuló. No entra en la bandera "revisar" (los
--     umbrales se ajustan con el piloto).
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
           -- 6: un código cuya visita se anuló ya no cuenta como reclamado
           count(*) filter (where c.reclamado_en is not null and vc.anulada_en is null) as reclamados
    from public.codigos c
    left join public.visitas vc on vc.id = c.visita_id
    where c.negocio_id = v_negocio.id
      and c.creado_en >= v_inicio
    group by c.creado_por
  ),
  man as (
    select v.mesero_id as user_id,
           count(*) filter (where v.origen = 'manual' and v.anulada_en is null) as manuales,  -- 6
           count(*) filter (where v.anulada_en is not null) as anuladas                       -- 6
    from public.visitas v
    where v.negocio_id = v_negocio.id
      and v.dia_local between v_desde and v_hoy
      and (v.origen = 'manual' or v.anulada_en is not null)
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
           coalesce(man.anuladas, 0) as anuladas,
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
    where f.role = 'mesero' or f.generados > 0 or f.manuales > 0 or f.anuladas > 0
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre', r.nombre,
           'rol', r.role,
           'generados', r.generados,
           'reclamados', r.reclamados,
           'manuales', r.manuales,
           'anuladas', r.anuladas,
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


-- ═══ 9. grafica_dueno: sin visitas anuladas ═══
-- Idéntica a la de la Fase 4D salvo "primer día con visitas" y el CTE "vis".
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
    and v.cliente_id is not null
    and v.anulada_en is null;  -- 6

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
      and v.anulada_en is null  -- 6
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


-- ═══ 10. admin_negocios: "visitas 7 días" sin anuladas ═══
-- Idéntica a la de la Fase 5A salvo el conteo de visitas.
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
      and vi.anulada_en is null  -- 6
      and vi.dia_local between (now() at time zone coalesce(n.zona_horaria, 'America/Cancun'))::date - 6
                           and (now() at time zone coalesce(n.zona_horaria, 'America/Cancun'))::date
  ) v;

  return jsonb_build_object('negocios', v_lista);
end;
$$;

revoke all on function public.admin_negocios() from public, anon, authenticated;
grant execute on function public.admin_negocios() to authenticated;


-- ═══ 11. public_get_landing: "visitas registradas" sin anuladas ═══
-- Idéntica a la de phase-3-rls.sql salvo el conteo de visitas. La página
-- pública del negocio (#/landing) muestra visit_count como "Visitas
-- registradas"; las visitas solo se cuentan, nunca se devuelven.
create or replace function public.public_get_landing(p_business_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'business', public.public_get_business(p_business_id),
    'levels', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nombre', l.nombre,
        'emoji', l.emoji,
        'visitas_minimas', l.visitas_minimas,
        'premio_bienvenida', l.premio_bienvenida
      ) order by l.visitas_minimas)
      from public.niveles l where l.negocio_id = p_business_id
    ), '[]'::jsonb),
    'customer_count', (select count(*) from public.clientes c where c.negocio_id = p_business_id),
    'visit_count', (select count(*) from public.visitas v where v.negocio_id = p_business_id
                    and v.anulada_en is null)  -- 6: las anuladas no cuentan
  )
  where public.public_get_business(p_business_id) is not null;
$$;

revoke all on function public.public_get_landing(uuid) from public, anon, authenticated;
grant execute on function public.public_get_landing(uuid) to anon, authenticated;


-- ═══ 12. Comprobaciones finales ═══
do $$
declare
  v_funcion text;
begin
  -- Columnas nuevas.
  if (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'visitas'
        and column_name in ('anulada_en', 'anulada_por', 'anulada_motivo')) <> 3 then
    raise exception 'Faltan columnas de anulación en visitas.';
  end if;

  -- Nadie modifica visitas directo: la anulación solo pasa por la función.
  if has_table_privilege('authenticated', 'public.visitas', 'update')
     or has_table_privilege('authenticated', 'public.visitas', 'delete')
     or has_any_column_privilege('authenticated', 'public.visitas', 'update')
     or has_table_privilege('anon', 'public.visitas', 'update') then
    raise exception 'authenticated/anon NO deben poder modificar visitas directo.';
  end if;

  -- Todas: security definer con search_path vacío.
  foreach v_funcion in array array[
    'public.anular_visita(uuid, text)',
    'public.reclamar_codigo(text, text, text, text)',
    'public.tarjeta_por_token(text)',
    'public.visita_manual(text, text)',
    'public.resumen_dueno()',
    'public.clientes_inactivos()',
    'public.resumen_meseros()',
    'public.grafica_dueno(text)',
    'public.admin_negocios()',
    'public.public_get_landing(uuid)'
  ] loop
    if not exists (
      select 1 from pg_proc
      where oid = to_regprocedure(v_funcion)
        and prosecdef
        and 'search_path=""' = any (proconfig)
    ) then
      raise exception '% debe ser security definer con search_path vacío.', v_funcion;
    end if;
    if v_funcion <> 'public.anular_visita(uuid, text)'
       and position('anulada_en is null' in (select prosrc from pg_proc where oid = to_regprocedure(v_funcion))) = 0 then
      raise exception '% debe ignorar las visitas anuladas.', v_funcion;
    end if;
  end loop;

  -- Permisos de anular_visita: solo con sesión (la función revisa el rol).
  if has_function_privilege('anon', 'public.anular_visita(uuid, text)', 'execute') then
    raise exception 'anon NO debe poder ejecutar anular_visita.';
  end if;
  if not has_function_privilege('authenticated', 'public.anular_visita(uuid, text)', 'execute') then
    raise exception 'authenticated debe poder ejecutar anular_visita.';
  end if;

  -- El cliente sin sesión sigue pudiendo reclamar, ver su tarjeta y la página
  -- pública del negocio.
  if not has_function_privilege('anon', 'public.reclamar_codigo(text, text, text, text)', 'execute')
     or not has_function_privilege('anon', 'public.tarjeta_por_token(text)', 'execute')
     or not has_function_privilege('anon', 'public.public_get_landing(uuid)', 'execute') then
    raise exception 'anon debe poder ejecutar reclamar_codigo, tarjeta_por_token y public_get_landing.';
  end if;
  -- Y las del panel siguen cerradas para anon.
  if has_function_privilege('anon', 'public.resumen_dueno()', 'execute')
     or has_function_privilege('anon', 'public.resumen_meseros()', 'execute')
     or has_function_privilege('anon', 'public.grafica_dueno(text)', 'execute')
     or has_function_privilege('anon', 'public.visita_manual(text, text)', 'execute')
     or has_function_privilege('anon', 'public.admin_negocios()', 'execute') then
    raise exception 'anon NO debe poder ejecutar funciones del panel ni la captura manual.';
  end if;
end;
$$;


commit;


-- ═══════════════════════════════════════════════════════════════════════
-- PRUEBAS (después de aplicar; un bloque a la vez; terminan en rollback)
-- ═══════════════════════════════════════════════════════════════════════
-- Usan un NEGOCIO DE PRUEBA (meta 3, límite 1 visita al día): "prestan" al
-- primer dueño real moviendo su perfil a ese negocio solo dentro de la
-- prueba (el rollback lo regresa). Teléfonos +5299800007xx.
-- Cada bloque termina con un NOTICE "OK ..." o con ERROR "FALLÓ ...".
/*

-- ═══ PRUEBA 1: reglas de anular_visita, límite diario y panel ═══
-- Datos (meta 3):
--   Ana:   visitas hace 3, 2 y 1 días → premio de 3 puntos entregado hace
--          13 h → visita a mano HOY (registrada por el dueño). Puntos 1.
--   Carla: 4 visitas antes de su premio de 3 (hace 4, 3, 2 días y hace 20 h),
--          premio entregado hace 13 h. Puntos 1 (le sobró uno).
--   Beto:  una visita hace 10 días (para que la gráfica tenga una semana).
--   Otro negocio con una visita (para probar "ajena").
-- Esperado: NOTICE "OK: anular_visita pasó las 17 comprobaciones".
-- (Cerca de medianoche los días pueden recorrerse uno.)
begin;
with n as (
  insert into public.negocios (nombre, email, meta_puntos, premio, limite_visitas_dia)
  values ('Prueba Fase 6', 'prueba-fase-6@example.invalid', 3, 'Un café', 1)
  returning id
)
select set_config('prueba.negocio', id::text, true) from n;
with n as (
  insert into public.negocios (nombre, email, meta_puntos, premio)
  values ('Prueba Fase 6 ajeno', 'prueba-fase-6b@example.invalid', 3, 'Un café')
  returning id
)
select set_config('prueba.ajeno', id::text, true) from n;
select set_config('prueba.dueno', p.user_id::text, true)
from public.profiles p join public.negocios ne on ne.id = p.negocio_id
where p.role = 'owner' and p.activo and ne.activo is true order by p.created_at limit 1;
update public.profiles set negocio_id = current_setting('prueba.negocio')::uuid
where user_id = current_setting('prueba.dueno')::uuid;

-- Ids conocidos para las visitas que se van a anular.
select set_config('prueba.v_ana2',  gen_random_uuid()::text, true),
       set_config('prueba.v_ana3',  gen_random_uuid()::text, true),
       set_config('prueba.v_anahoy', gen_random_uuid()::text, true),
       set_config('prueba.v_carla3', gen_random_uuid()::text, true),
       set_config('prueba.v_carla4', gen_random_uuid()::text, true),
       set_config('prueba.v_ajena', gen_random_uuid()::text, true);

with c as (
  insert into public.clientes (negocio_id, telefono, nombre, puntos_actuales, total_visitas)
  values (current_setting('prueba.negocio')::uuid, '+529980000701', 'Ana',   1, 4),
         (current_setting('prueba.negocio')::uuid, '+529980000702', 'Carla', 1, 4),
         (current_setting('prueba.negocio')::uuid, '+529980000703', 'Beto',  1, 1),
         (current_setting('prueba.ajeno')::uuid,   '+529980000799', 'Zoe',   1, 1)
  returning id, nombre
)
insert into public.visitas (id, cliente_id, negocio_id, fecha, origen, mesero_id)
select x.id, c.id, x.negocio, now() - x.hace, x.origen, x.mesero
from c join (values
  ('Ana',   gen_random_uuid(),                          current_setting('prueba.negocio')::uuid, interval '3 days',  'qr',     null::uuid),
  ('Ana',   current_setting('prueba.v_ana2')::uuid,     current_setting('prueba.negocio')::uuid, interval '2 days',  'qr',     null),
  ('Ana',   current_setting('prueba.v_ana3')::uuid,     current_setting('prueba.negocio')::uuid, interval '1 day',   'qr',     null),
  ('Ana',   current_setting('prueba.v_anahoy')::uuid,   current_setting('prueba.negocio')::uuid, interval '0',       'manual', current_setting('prueba.dueno')::uuid),
  ('Carla', gen_random_uuid(),                          current_setting('prueba.negocio')::uuid, interval '4 days',  'qr',     null),
  ('Carla', gen_random_uuid(),                          current_setting('prueba.negocio')::uuid, interval '3 days',  'qr',     null),
  ('Carla', current_setting('prueba.v_carla3')::uuid,   current_setting('prueba.negocio')::uuid, interval '2 days',  'qr',     null),
  ('Carla', current_setting('prueba.v_carla4')::uuid,   current_setting('prueba.negocio')::uuid, interval '20 hours','qr',     null),
  ('Beto',  gen_random_uuid(),                          current_setting('prueba.negocio')::uuid, interval '10 days', 'qr',     null),
  ('Zoe',   current_setting('prueba.v_ajena')::uuid,    current_setting('prueba.ajeno')::uuid,   interval '1 day',   'qr',     null)
) as x(nombre, id, negocio, hace, origen, mesero) on x.nombre = c.nombre;

insert into public.canjes (negocio_id, cliente_id, codigo, estado, creado_en, expira_en,
                           premio_texto, puntos_descontados, confirmado_por, confirmado_en)
select cl.negocio_id, cl.id, '0001', 'entregado', now() - interval '13 hours',
       now() - interval '13 hours' + interval '5 minutes', 'Un café', 3,
       current_setting('prueba.dueno')::uuid, now() - interval '13 hours'
from public.clientes cl
where cl.negocio_id = current_setting('prueba.negocio')::uuid and cl.nombre in ('Ana', 'Carla');

-- Dos QR para Luis (cliente nuevo que se registra hoy).
insert into public.codigos (negocio_id, codigo, creado_por, expira_en)
values (current_setting('prueba.negocio')::uuid, 'prueba-fase6-a-' || repeat('0', 20), current_setting('prueba.dueno')::uuid, now() + interval '10 minutes'),
       (current_setting('prueba.negocio')::uuid, 'prueba-fase6-b-' || repeat('0', 20), current_setting('prueba.dueno')::uuid, now() + interval '10 minutes');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);

do $$
declare
  v_err text;
  r jsonb;
  v_res_antes jsonb;
  v_graf_antes jsonb;
  v_mes_antes jsonb;
  v_mes_despues jsonb;
  v_luis uuid;
  v_token text;
  v_fila public.visitas%rowtype;
begin
  v_res_antes := public.resumen_dueno();
  v_graf_antes := public.grafica_dueno('semana');
  select e into v_mes_antes from jsonb_array_elements(public.resumen_meseros()->'meseros') e where e->>'rol' = 'owner';

  -- 1. Motivo vacío.
  v_err := null;
  begin perform public.anular_visita(current_setting('prueba.v_anahoy')::uuid, '  '); exception when others then v_err := sqlerrm; end;
  if v_err is distinct from 'MOTIVO_INVALIDO' then raise exception 'FALLÓ 1: esperaba MOTIVO_INVALIDO, salió %', coalesce(v_err, '(sin error)'); end if;

  -- 2. Visita de otro negocio: igual que inexistente.
  v_err := null;
  begin perform public.anular_visita(current_setting('prueba.v_ajena')::uuid, 'Prueba ajena'); exception when others then v_err := sqlerrm; end;
  if v_err is distinct from 'VISITA_NO_ENCONTRADA' then raise exception 'FALLÓ 2: esperaba VISITA_NO_ENCONTRADA, salió %', coalesce(v_err, '(sin error)'); end if;

  -- 3. Ana: visitas que pagaron su premio.
  v_err := null;
  begin perform public.anular_visita(current_setting('prueba.v_ana2')::uuid, 'Error del mesero'); exception when others then v_err := sqlerrm; end;
  if v_err is distinct from 'VISITA_CANJEADA' then raise exception 'FALLÓ 3a: esperaba VISITA_CANJEADA, salió %', coalesce(v_err, '(sin error)'); end if;
  v_err := null;
  begin perform public.anular_visita(current_setting('prueba.v_ana3')::uuid, 'Error del mesero'); exception when others then v_err := sqlerrm; end;
  if v_err is distinct from 'VISITA_CANJEADA' then raise exception 'FALLÓ 3b: esperaba VISITA_CANJEADA, salió %', coalesce(v_err, '(sin error)'); end if;

  -- 4. Carla: la 3.ª pagó el premio; la 4.ª (antes del premio) le sobró.
  v_err := null;
  begin perform public.anular_visita(current_setting('prueba.v_carla3')::uuid, 'Error del mesero'); exception when others then v_err := sqlerrm; end;
  if v_err is distinct from 'VISITA_CANJEADA' then raise exception 'FALLÓ 4a: esperaba VISITA_CANJEADA, salió %', coalesce(v_err, '(sin error)'); end if;
  r := public.anular_visita(current_setting('prueba.v_carla4')::uuid, 'Error del mesero');
  if (r->>'puntos')::int <> 0 then raise exception 'FALLÓ 4b: Carla debía quedar en 0 puntos, quedó %', r->>'puntos'; end if;

  -- 5. Ana: la visita de hoy (después del premio) sí se anula.
  r := public.anular_visita(current_setting('prueba.v_anahoy')::uuid, '  Se capturó   el número equivocado ');
  if (r->>'puntos')::int <> 0 or r->>'motivo' <> 'Se capturó el número equivocado' then
    raise exception 'FALLÓ 5a: respuesta inesperada %', r;
  end if;
  -- No se borró: sigue ahí, con quién, cuándo y por qué.
  select v.* into v_fila from public.visitas v where v.id = current_setting('prueba.v_anahoy')::uuid;
  if v_fila.id is null or v_fila.anulada_en is null
     or v_fila.anulada_por <> current_setting('prueba.dueno')::uuid
     or v_fila.anulada_motivo <> 'Se capturó el número equivocado' then
    raise exception 'FALLÓ 5b: la visita anulada no quedó marcada correctamente.';
  end if;
  if (select total_visitas from public.clientes where telefono = '+529980000701'
        and negocio_id = current_setting('prueba.negocio')::uuid) <> 3 then
    raise exception 'FALLÓ 5c: total_visitas de Ana debía bajar a 3.';
  end if;

  -- 6. Otra vez la misma.
  v_err := null;
  begin perform public.anular_visita(current_setting('prueba.v_anahoy')::uuid, 'Otra vez'); exception when others then v_err := sqlerrm; end;
  if v_err is distinct from 'VISITA_YA_ANULADA' then raise exception 'FALLÓ 6: esperaba VISITA_YA_ANULADA, salió %', coalesce(v_err, '(sin error)'); end if;

  -- 7. Panel: dos visitas menos esta semana (Ana hoy y Carla hace 20 h),
  --    en el resumen y en la gráfica.
  if (public.resumen_dueno()->>'visitas_semana')::int <> (v_res_antes->>'visitas_semana')::int - 2 then
    raise exception 'FALLÓ 7a: resumen_dueno no descontó las anuladas.';
  end if;
  if (public.grafica_dueno('semana')->>'total')::int <> (v_graf_antes->>'total')::int - 2 then
    raise exception 'FALLÓ 7b: grafica_dueno no descontó las anuladas.';
  end if;
  -- Tabla por mesero: la captura a mano anulada ya no cuenta y aparece en "anuladas".
  select e into v_mes_despues from jsonb_array_elements(public.resumen_meseros()->'meseros') e where e->>'rol' = 'owner';
  if (v_mes_antes->>'manuales')::int <> 1 or coalesce((v_mes_despues->>'manuales')::int, 0) <> 0
     or coalesce((v_mes_despues->>'anuladas')::int, 0) <> 1 then
    raise exception 'FALLÓ 7c: resumen_meseros antes % / después %', v_mes_antes, v_mes_despues;
  end if;

  -- 8. Límite diario: Ana ya puede volver a sumar hoy (a mano).
  r := public.visita_manual('9980000701', null);
  if (r->>'puntos')::int <> 1 then raise exception 'FALLÓ 8: Ana debía volver a 1 punto, quedó %', r->>'puntos'; end if;

  -- 9. Límite diario por QR: Luis suma, se anula, y puede sumar con otro QR hoy.
  perform public.reclamar_codigo('prueba-fase6-a-' || repeat('0', 20), null, '9980000704', 'Luis');
  select v.id into v_luis from public.visitas v join public.clientes cl on cl.id = v.cliente_id
  where cl.telefono = '+529980000704' and cl.negocio_id = current_setting('prueba.negocio')::uuid;
  r := public.anular_visita(v_luis, 'El cliente no estaba');
  if (r->>'puntos')::int <> 0 then raise exception 'FALLÓ 9a: Luis debía quedar en 0.'; end if;
  r := public.reclamar_codigo('prueba-fase6-b-' || repeat('0', 20), null, '9980000704', null);
  if (r->>'puntos')::int <> 1 then raise exception 'FALLÓ 9b: Luis debía poder sumar otra vez hoy.'; end if;

  -- 10. La tarjeta de Luis solo muestra su visita válida.
  v_token := r->>'token';
  if jsonb_array_length(public.tarjeta_por_token(v_token)->'visitas') <> 1 then
    raise exception 'FALLÓ 10: la tarjeta muestra visitas anuladas.';
  end if;

  raise notice 'OK: anular_visita pasó las 17 comprobaciones';
end;
$$;
rollback;


-- ═══ PRUEBA 2: un mesero no puede anular ═══
-- (Necesita un perfil con rol "mesero".)
-- Esperado: ERROR: Acceso denegado
begin;
select set_config('prueba.mesero', p.user_id::text, true)
from public.profiles p where p.role = 'mesero' and p.activo order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.mesero'), 'role', 'authenticated')::text, true);
select public.anular_visita(gen_random_uuid(), 'Prueba de mesero');
rollback;


-- ═══ PRUEBA 3: sin sesión no se puede anular ═══
-- Esperado: ERROR: permission denied for function anular_visita
begin;
set local role anon;
select public.anular_visita(gen_random_uuid(), 'Prueba sin sesión');
rollback;


-- ═══ PRUEBA 4: negocio desactivado ═══
-- Esperado: ERROR: NEGOCIO_INACTIVO
begin;
select set_config('prueba.dueno', p.user_id::text, true),
       set_config('prueba.negocio', p.negocio_id::text, true)
from public.profiles p join public.negocios ne on ne.id = p.negocio_id
where p.role = 'owner' and p.activo and ne.activo is true order by p.created_at limit 1;
update public.negocios set activo = false where id = current_setting('prueba.negocio')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select public.anular_visita(gen_random_uuid(), 'Prueba negocio inactivo');
rollback;


-- ═══ PRUEBA 5: mismo negocio, mismos números de antes si nada se anuló ═══
-- Las funciones reemplazadas devuelven lo mismo que antes mientras no haya
-- visitas anuladas. Correr ANTES de aplicar y DESPUÉS, y comparar a ojo.
-- Esperado: los mismos valores en las dos corridas (salvo "anuladas": 0).
begin;
select set_config('prueba.dueno', p.user_id::text, true)
from public.profiles p join public.negocios ne on ne.id = p.negocio_id
where p.role = 'owner' and p.activo and ne.activo is true order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select public.resumen_dueno() as resumen,
       public.resumen_meseros() as meseros,
       public.grafica_dueno('semana') as grafica;
rollback;

*/
