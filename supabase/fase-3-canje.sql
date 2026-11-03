-- Fase 3: canje del premio con dos llaves.
-- El cliente genera un código de 4 dígitos en su celular (llave 1) y el mesero
-- lo escribe y confirma la entrega viendo al cliente (llave 2). Ni el mesero
-- canjea sin el celular del cliente, ni el cliente sin el mesero.
--
-- Todo va en UNA transacción: si cualquier paso falla, no se aplica nada.
-- Correr completo en el editor SQL de Supabase. Las pruebas van al final,
-- DESPUÉS del commit, comentadas: se copian y se corren un bloque a la vez.
--
-- Qué hace con la tabla canjes que ya existe:
--   La vieja (id, cliente_id, premio_id → premios, fecha sin zona horaria) no
--   la usa la app y está cerrada desde la fase 3 de seguridad. No sirve para
--   el canje con código: le faltan negocio, código, estado, caducidad, quién
--   confirmó y la copia del premio. Se BORRA y se crea de nuevo, pero SOLO si
--   está vacía (la comprobación previa aborta si tiene filas).
--
-- Funciones del cliente (SIN sesión, con su token de dispositivo):
--   crear_canje(token)              → código de 4 dígitos (o el pendiente vigente)
--   estado_canje(token, código)     → pendiente / entregado / cancelado / caducado
--   cancelar_canje(token, código)   → el cliente se arrepiente
-- Funciones del mesero o dueño (CON sesión):
--   consultar_canje(código)         → premio, nombre y últimos 4 (no cambia nada del canje)
--   confirmar_canje(canje_id)       → entrega atómica y descuento de puntos
--
-- Errores que verá la app (en error.message):
--   'TOKEN_INVALIDO'        el teléfono recordado ya no sirve
--   'NEGOCIO_INACTIVO'      el negocio está desactivado
--   'NUMERO_EXCLUIDO'       número del personal: no canjea premios
--   'PUNTOS_INSUFICIENTES'  no completó la meta (o ya no tiene los puntos al confirmar)
--   'SIN_CODIGOS'           no se encontró un código libre (prácticamente imposible)
--   'CANJE_NO_ENCONTRADO'   no existe, o no es de este cliente / de este negocio
--   'CANJE_YA_ENTREGADO' / 'CANJE_CANCELADO' / 'CANJE_CADUCADO'
--   'Acceso denegado'       sin sesión o sin rol de mesero/dueño
--   'DEMASIADOS_INTENTOS'   5 códigos incorrectos seguidos; detail = segundos que faltan
-- Un código incorrecto en consultar_canje NO es un error: responde
-- {"estado": "no_encontrado", "intentos_restantes": n}. Si fuera un error, la
-- transacción se revertiría y el intento fallido no quedaría contado.

begin;


-- ═══ 0. Comprobaciones previas ═══
do $$
declare
  v_filas bigint;
begin
  if to_regclass('public.canjes') is null then
    raise exception 'No existe la tabla canjes; revisar el esquema antes de seguir.';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'canjes' and column_name = 'estado'
  ) then
    raise exception 'La fase 3 ya se aplicó (canjes.estado existe).';
  end if;

  select count(*) into v_filas from public.canjes;
  if v_filas > 0 then
    raise exception 'La tabla canjes tiene % filas; se esperaba vacía. Revisar antes de rediseñarla.', v_filas;
  end if;

  if to_regclass('public.dispositivos_cliente') is null
     or to_regclass('public.numeros_excluidos') is null then
    raise exception 'Falta la fase 2A.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'negocios' and column_name = 'premio'
  ) then
    raise exception 'Falta negocios.premio (fase 2A).';
  end if;
  if to_regprocedure('public.user_has_business_role(uuid, text[])') is null then
    raise exception 'Falta user_has_business_role (fase 3 de seguridad).';
  end if;
  if to_regprocedure('extensions.gen_random_bytes(integer)') is null then
    raise exception 'No se encontró extensions.gen_random_bytes (pgcrypto).';
  end if;
end;
$$;


-- ═══ 1. Tabla canjes (rediseño) ═══
-- Sin "cascade": si algo depende de la tabla vieja, el drop falla y no se
-- aplica nada.
drop table public.canjes;

create table public.canjes (
  id uuid primary key default gen_random_uuid(),
  -- Sin "on delete cascade": un canje es historial del cliente y nunca se
  -- borra por limpieza técnica (igual que clientes y visitas).
  negocio_id uuid not null references public.negocios (id),
  cliente_id uuid not null references public.clientes (id),
  codigo text not null,
  estado text not null default 'pendiente',
  creado_en timestamptz not null default now(),
  expira_en timestamptz not null,
  -- Copias al momento de crearlo: si el dueño cambia el premio o la meta
  -- mientras el cliente está frente al mesero, este canje no cambia.
  premio_texto text not null,
  puntos_descontados integer not null,
  -- Quién y cuándo confirmó la entrega (mesero o dueño). Si se borra el
  -- usuario, el canje se queda; solo se pierde quién fue.
  confirmado_por uuid references auth.users (id) on delete set null,
  confirmado_en timestamptz,
  cancelado_en timestamptz,

  constraint canjes_codigo_formato check (codigo ~ '^[0-9]{4}$'),
  constraint canjes_estado_valido check (estado in ('pendiente', 'entregado', 'cancelado', 'caducado')),
  constraint canjes_expira_despues check (expira_en > creado_en),
  constraint canjes_premio_largo check (length(premio_texto) between 1 and 80),
  constraint canjes_puntos_positivos check (puntos_descontados > 0),
  -- "entregado" siempre lleva la hora de confirmación, y solo él la lleva.
  constraint canjes_entregado_con_hora check ((estado = 'entregado') = (confirmado_en is not null)),
  constraint canjes_cancelado_con_hora check ((estado = 'cancelado') = (cancelado_en is not null))
);

-- Un solo canje pendiente por cliente. Es el respaldo del bloqueo de crear_canje.
create unique index canjes_un_pendiente_por_cliente_uidx
on public.canjes (cliente_id) where estado = 'pendiente';

-- Un código pendiente no se repite dentro del negocio: cuando el mesero
-- escribe 4 dígitos, encuentra uno y solo un canje.
create unique index canjes_codigo_pendiente_uidx
on public.canjes (negocio_id, codigo) where estado = 'pendiente';

-- Panel del dueño (Fase 4) y búsqueda del canje del cliente por código.
create index canjes_negocio_creado_idx on public.canjes (negocio_id, creado_en);
create index canjes_cliente_creado_idx on public.canjes (cliente_id, creado_en);


-- ═══ 2. Tabla canje_intentos (antifraude del mesero) ═══
-- Cuenta los códigos incorrectos seguidos de cada usuario. Con 5 seguidos,
-- queda bloqueado 5 minutos. "bloqueos" acumula cuántas veces pasó (para el
-- reporte por mesero de la Fase 4).
create table public.canje_intentos (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  fallos integer not null default 0,
  bloqueado_hasta timestamptz,
  bloqueos integer not null default 0,
  actualizado_en timestamptz not null default now(),

  constraint canje_intentos_fallos_rango check (fallos between 0 and 5),
  constraint canje_intentos_bloqueos_positivo check (bloqueos >= 0)
);


-- ═══ 3. Permisos y RLS de las tablas ═══
-- Supabase da TODOS los permisos de las tablas nuevas a anon y authenticated.
-- Se quitan. Nadie escribe directo: todo pasa por las funciones de abajo.
alter table public.canjes enable row level security;
alter table public.canje_intentos enable row level security;

revoke all on table public.canjes from public, anon, authenticated;
revoke all on table public.canje_intentos from public, anon, authenticated;

-- El dueño lee los canjes de su negocio (para su panel en la Fase 4), con
-- dos candados para que él tampoco pueda saltarse la llave del cliente:
--   1. La política esconde los canjes pendientes vigentes: sin su id no puede
--      llamar confirmar_canje sin pasar por consultar_canje (que pide el código).
--   2. No tiene permiso sobre la columna "codigo".
-- Por eso Fase 4 debe pedir columnas explícitas (no "select *").
-- El mesero NO lee la tabla: vería los canjes del negocio sin el celular del cliente.
create policy canjes_select_owner
on public.canjes for select to authenticated
using (
  public.user_has_business_role(negocio_id, array['owner'])
  and (estado <> 'pendiente' or expira_en <= now())
);

grant select (
  id, negocio_id, cliente_id, estado, creado_en, expira_en,
  premio_texto, puntos_descontados, confirmado_por, confirmado_en, cancelado_en
) on public.canjes to authenticated;

-- canje_intentos: sin políticas ni permisos. Solo la usan las funciones.


-- ═══ 4. crear_canje(token) ═══
-- El cliente toca "Canjear mi premio". Lo llama SIN sesión, con su token.
-- Bloqueos, para que nada se cuente dos veces:
--   - uno por negocio (advisory lock): dos clientes del mismo negocio que
--     piden código a la vez no pueden sacar el mismo, y dos toques del mismo
--     cliente no crean dos canjes. Negocios distintos no se esperan entre sí.
--   - no bloquea al cliente: confirmar_canje vuelve a revisar los puntos con
--     el cliente bloqueado.
create or replace function public.crear_canje(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente public.clientes%rowtype;
  v_negocio public.negocios%rowtype;
  v_canje public.canjes%rowtype;
  v_meta integer;
  v_codigo text;
  v_bytes bytea;
  v_vueltas integer := 0;
begin
  -- 4.1 ¿Quién es? El token identifica a un cliente de un solo negocio.
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

  -- Números del personal: no ganan puntos y tampoco canjean (por si el dueño
  -- agregó el número después de que juntó puntos).
  if exists (
    select 1 from public.numeros_excluidos e
    where e.negocio_id = v_negocio.id and e.telefono = v_cliente.telefono
  ) then
    raise exception 'NUMERO_EXCLUIDO';
  end if;

  -- 4.2 Un canje a la vez por negocio, hasta que termine la transacción.
  perform pg_advisory_xact_lock(hashtextextended('sello.crear_canje:' || v_negocio.id::text, 0));

  -- 4.3 Los pendientes que ya caducaron pasan a "caducado".
  -- Los del cliente se marcan siempre (si el mesero está confirmando uno en
  -- ese instante, se espera a que termine): así no estorban al índice de
  -- "un pendiente por cliente".
  update public.canjes c
  set estado = 'caducado'
  where c.cliente_id = v_cliente.id
    and c.estado = 'pendiente'
    and c.expira_en <= now();

  -- Los demás del negocio, solo como limpieza y sin esperar a nadie
  -- ("skip locked"): si alguno está ocupado, se queda para la próxima.
  update public.canjes c
  set estado = 'caducado'
  where c.id in (
    select c2.id
    from public.canjes c2
    where c2.negocio_id = v_negocio.id
      and c2.estado = 'pendiente'
      and c2.expira_en <= now()
    for update skip locked
  )
    and c.estado = 'pendiente';

  -- 4.4 Puntos al día (pudieron cambiar mientras se esperaba el bloqueo).
  select cl.* into v_cliente
  from public.clientes cl
  where cl.id = v_cliente.id;

  v_meta := coalesce(v_negocio.meta_puntos, 10);

  -- 4.5 Si ya tiene un canje pendiente vigente, se devuelve ese mismo.
  -- Sus puntos se comparan con la copia del canje, no con la meta actual.
  select c.* into v_canje
  from public.canjes c
  where c.cliente_id = v_cliente.id
    and c.estado = 'pendiente'
    and c.expira_en > now();

  if v_canje.id is not null then
    if coalesce(v_cliente.puntos_actuales, 0) < v_canje.puntos_descontados then
      raise exception 'PUNTOS_INSUFICIENTES';
    end if;
  else
    -- 4.6 Canje nuevo: solo con la meta completa.
    if coalesce(v_cliente.puntos_actuales, 0) < v_meta then
      raise exception 'PUNTOS_INSUFICIENTES';
    end if;

    -- Código de 4 dígitos con bytes aleatorios del servidor (no random(),
    -- que es predecible). 3 bytes = 0 a 16,777,215; "mod 10000" deja un sesgo
    -- de menos de 0.1 %, que aquí no importa.
    -- Se evita cualquier código que otro canje del negocio tenga como
    -- "pendiente", aunque ya haya caducado y la limpieza lo haya saltado:
    -- así el índice único nunca falla.
    loop
      v_vueltas := v_vueltas + 1;
      if v_vueltas > 50 then
        raise exception 'SIN_CODIGOS';
      end if;
      v_bytes := extensions.gen_random_bytes(3);
      v_codigo := lpad(
        ((get_byte(v_bytes, 0) * 65536 + get_byte(v_bytes, 1) * 256 + get_byte(v_bytes, 2)) % 10000)::text,
        4, '0');
      exit when not exists (
        select 1 from public.canjes c
        where c.negocio_id = v_negocio.id
          and c.estado = 'pendiente'
          and c.codigo = v_codigo
      );
    end loop;

    insert into public.canjes (negocio_id, cliente_id, codigo, expira_en, premio_texto, puntos_descontados)
    values (
      v_negocio.id,
      v_cliente.id,
      v_codigo,
      now() + interval '5 minutes',
      coalesce(nullif(btrim(v_negocio.premio), ''), 'Premio del programa'),
      v_meta
    )
    returning * into v_canje;
  end if;

  -- segundos_restantes: el celular arma su cuenta regresiva con esto, no con
  -- su propio reloj (puede estar mal puesto).
  return jsonb_build_object(
    'codigo', v_canje.codigo,
    'estado', 'pendiente',
    'premio', v_canje.premio_texto,
    'puntos', v_canje.puntos_descontados,
    'segundos_restantes', greatest(0, ceil(extract(epoch from v_canje.expira_en - now())))::integer
  );
end;
$$;


-- ═══ 5. estado_canje(token, código) ═══
-- El celular del cliente pregunta cada ~3 s si el mesero ya entregó.
-- Solo lee. Un pendiente que ya pasó su hora se reporta como "caducado"
-- aunque nadie lo haya marcado todavía.
create or replace function public.estado_canje(p_token text, p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cliente_id uuid;
  v_canje public.canjes%rowtype;
  v_vigente boolean;
begin
  if p_token is null or length(p_token) not between 32 and 128 then
    raise exception 'TOKEN_INVALIDO';
  end if;

  select d.cliente_id into v_cliente_id
  from public.dispositivos_cliente d
  where d.token_hash = sha256(convert_to(p_token, 'UTF8'));

  if v_cliente_id is null then
    raise exception 'TOKEN_INVALIDO';
  end if;

  if p_codigo is null or p_codigo !~ '^[0-9]{4}$' then
    raise exception 'CANJE_NO_ENCONTRADO';
  end if;

  -- El más reciente de ESTE cliente con ese código (un código puede volver a
  -- salir otro día; el canje de hoy es el último).
  select c.* into v_canje
  from public.canjes c
  where c.cliente_id = v_cliente_id
    and c.codigo = p_codigo
  order by c.creado_en desc
  limit 1;

  if v_canje.id is null then
    raise exception 'CANJE_NO_ENCONTRADO';
  end if;

  v_vigente := v_canje.estado = 'pendiente' and v_canje.expira_en > now();

  return jsonb_build_object(
    'estado', case
      when v_canje.estado = 'pendiente' and not v_vigente then 'caducado'
      else v_canje.estado
    end,
    'premio', v_canje.premio_texto,
    'segundos_restantes', case
      when v_vigente then greatest(0, ceil(extract(epoch from v_canje.expira_en - now())))::integer
      else 0
    end
  );
end;
$$;


-- ═══ 6. cancelar_canje(token, código) ═══
-- El cliente toca "Cancelar". Si ya estaba cancelado o caducado, responde
-- sin error (tocar dos veces no falla). Si el mesero ya lo entregó, avisa.
-- "for update": si el mesero lo está confirmando en ese instante, una de las
-- dos operaciones espera a la otra.
create or replace function public.cancelar_canje(p_token text, p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente_id uuid;
  v_canje public.canjes%rowtype;
begin
  if p_token is null or length(p_token) not between 32 and 128 then
    raise exception 'TOKEN_INVALIDO';
  end if;

  select d.cliente_id into v_cliente_id
  from public.dispositivos_cliente d
  where d.token_hash = sha256(convert_to(p_token, 'UTF8'));

  if v_cliente_id is null then
    raise exception 'TOKEN_INVALIDO';
  end if;

  if p_codigo is null or p_codigo !~ '^[0-9]{4}$' then
    raise exception 'CANJE_NO_ENCONTRADO';
  end if;

  select c.* into v_canje
  from public.canjes c
  where c.cliente_id = v_cliente_id
    and c.codigo = p_codigo
  order by c.creado_en desc
  limit 1
  for update;

  if v_canje.id is null then
    raise exception 'CANJE_NO_ENCONTRADO';
  end if;
  if v_canje.estado = 'entregado' then
    raise exception 'CANJE_YA_ENTREGADO';
  end if;

  if v_canje.estado = 'pendiente' then
    if v_canje.expira_en <= now() then
      update public.canjes set estado = 'caducado'
      where id = v_canje.id
      returning * into v_canje;
    else
      update public.canjes set estado = 'cancelado', cancelado_en = now()
      where id = v_canje.id
      returning * into v_canje;
    end if;
  end if;

  return jsonb_build_object('estado', v_canje.estado);
end;
$$;


-- ═══ 7. consultar_canje(código) ═══
-- El mesero escribe los 4 dígitos. Devuelve premio, nombre y últimos 4 del
-- cliente para que los compare con quien tiene enfrente. No toca el canje.
-- Antifraude: 5 códigos incorrectos seguidos bloquean al usuario 5 minutos.
-- Un acierto pone el contador en 0; 15 minutos sin fallar, también.
create or replace function public.consultar_canje(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_negocio public.negocios%rowtype;
  v_intento public.canje_intentos%rowtype;
  v_canje public.canjes%rowtype;
  v_cliente public.clientes%rowtype;
begin
  -- 7.1 Quién llama: mesero o dueño de un negocio activo (sale de la sesión).
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

  -- 7.2 Contador de intentos del usuario, bloqueado: si manda dos consultas
  -- a la vez, la segunda espera y cuenta con la primera.
  insert into public.canje_intentos (usuario_id)
  values (v_usuario)
  on conflict (usuario_id) do nothing;

  select i.* into v_intento
  from public.canje_intentos i
  where i.usuario_id = v_usuario
  for update;

  if v_intento.bloqueado_hasta > now() then
    raise exception 'DEMASIADOS_INTENTOS'
      using detail = greatest(1, ceil(extract(epoch from v_intento.bloqueado_hasta - now())))::integer::text;
  end if;

  -- 15 minutos sin intentos: los fallos viejos ya no cuentan como "seguidos".
  if v_intento.fallos > 0 and v_intento.actualizado_en < now() - interval '15 minutes' then
    v_intento.fallos := 0;
  end if;

  -- 7.3 El canje más reciente del negocio con ese código (últimos 15 minutos).
  -- Dos canjes con el mismo código nunca están pendientes a la vez (índice
  -- único), así que si hay uno pendiente y vigente, es el más reciente.
  if p_codigo ~ '^[0-9]{4}$' then
    select c.* into v_canje
    from public.canjes c
    where c.negocio_id = v_negocio.id
      and c.codigo = p_codigo
      and c.creado_en > now() - interval '15 minutes'
    order by c.creado_en desc
    limit 1;
  end if;

  -- 7.4 Acierto: pendiente y vigente.
  if v_canje.id is not null and v_canje.estado = 'pendiente' and v_canje.expira_en > now() then
    update public.canje_intentos
    set fallos = 0, bloqueado_hasta = null, actualizado_en = now()
    where usuario_id = v_usuario;

    select cl.* into v_cliente
    from public.clientes cl
    where cl.id = v_canje.cliente_id;

    return jsonb_build_object(
      'estado', 'pendiente',
      'canje_id', v_canje.id,
      'premio', v_canje.premio_texto,
      'nombre', coalesce(v_cliente.nombre, 'Cliente'),
      'ultimos4', right(v_cliente.telefono, 4),
      'puntos', coalesce(v_cliente.puntos_actuales, 0),
      'puntos_descontados', v_canje.puntos_descontados,
      'segundos_restantes', greatest(0, ceil(extract(epoch from v_canje.expira_en - now())))::integer
    );
  end if;

  -- 7.5 Código real de hace unos minutos que ya no está pendiente: se le dice
  -- al mesero qué pasó. No cuenta como fallo (no sirve para adivinar nada:
  -- ese código ya no se puede canjear) ni pone el contador en 0.
  if v_canje.id is not null then
    return jsonb_build_object(
      'estado', case when v_canje.estado = 'pendiente' then 'caducado' else v_canje.estado end
    );
  end if;

  -- 7.6 Código incorrecto: se cuenta. Se RESPONDE (no se lanza un error) para
  -- que el conteo quede guardado.
  v_intento.fallos := v_intento.fallos + 1;

  if v_intento.fallos >= 5 then
    update public.canje_intentos
    set fallos = 0,
        bloqueado_hasta = now() + interval '5 minutes',
        bloqueos = bloqueos + 1,
        actualizado_en = now()
    where usuario_id = v_usuario;

    return jsonb_build_object('estado', 'no_encontrado', 'intentos_restantes', 0, 'bloqueado_segundos', 300);
  end if;

  update public.canje_intentos
  set fallos = v_intento.fallos, actualizado_en = now()
  where usuario_id = v_usuario;

  return jsonb_build_object(
    'estado', 'no_encontrado',
    'intentos_restantes', 5 - v_intento.fallos,
    'bloqueado_segundos', 0
  );
end;
$$;


-- ═══ 8. confirmar_canje(canje_id) ═══
-- El mesero toca "Confirmar entrega" viendo al cliente. Atómica:
--   1. bloquea el canje ("for update"): dos meseros confirmando el mismo
--      canje a la vez → el segundo espera y ve "ya entregado";
--   2. revisa que siga pendiente y vigente;
--   3. bloquea al cliente y revisa que aún tenga los puntos (pudo canjear
--      otro premio o el dueño cambió algo);
--   4. descuenta los puntos de la copia del canje y marca "entregado" con
--      quién confirmó y a qué hora.
-- Orden de bloqueos: canje → cliente. Las demás funciones nunca bloquean en
-- el orden contrario, así no hay bloqueos cruzados.
create or replace function public.confirmar_canje(p_canje_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_negocio public.negocios%rowtype;
  v_canje public.canjes%rowtype;
  v_cliente public.clientes%rowtype;
begin
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

  -- Solo canjes de SU negocio. Uno ajeno responde igual que uno inexistente.
  select c.* into v_canje
  from public.canjes c
  where c.id = p_canje_id
    and c.negocio_id = v_negocio.id
  for update;

  if v_canje.id is null then
    raise exception 'CANJE_NO_ENCONTRADO';
  end if;
  if v_canje.estado = 'entregado' then
    raise exception 'CANJE_YA_ENTREGADO';
  end if;
  if v_canje.estado = 'cancelado' then
    raise exception 'CANJE_CANCELADO';
  end if;
  if v_canje.estado = 'caducado' or v_canje.expira_en <= now() then
    raise exception 'CANJE_CADUCADO';
  end if;

  select cl.* into v_cliente
  from public.clientes cl
  where cl.id = v_canje.cliente_id
  for update;

  if coalesce(v_cliente.puntos_actuales, 0) < v_canje.puntos_descontados then
    raise exception 'PUNTOS_INSUFICIENTES';
  end if;

  -- Se descuentan los puntos del premio, no todos: con 11/10 queda en 1/10.
  update public.clientes
  set puntos_actuales = coalesce(puntos_actuales, 0) - v_canje.puntos_descontados
  where id = v_cliente.id
  returning * into v_cliente;

  update public.canjes
  set estado = 'entregado',
      confirmado_por = v_usuario,
      confirmado_en = now()
  where id = v_canje.id
  returning * into v_canje;

  return jsonb_build_object(
    'canje_id', v_canje.id,
    'premio', v_canje.premio_texto,
    'nombre', coalesce(v_cliente.nombre, 'Cliente'),
    'ultimos4', right(v_cliente.telefono, 4),
    'puntos', v_cliente.puntos_actuales,
    'meta', coalesce(v_negocio.meta_puntos, 10),
    'confirmado_en', v_canje.confirmado_en
  );
end;
$$;


-- ═══ 9. Permisos de las funciones ═══
-- Supabase da permiso de ejecutar a todos por defecto. Se quita y se da
-- solo a quien corresponde.
revoke all on function public.crear_canje(text) from public, anon, authenticated;
revoke all on function public.estado_canje(text, text) from public, anon, authenticated;
revoke all on function public.cancelar_canje(text, text) from public, anon, authenticated;
revoke all on function public.consultar_canje(text) from public, anon, authenticated;
revoke all on function public.confirmar_canje(uuid) from public, anon, authenticated;

-- Las del cliente: sin sesión (anon) y con sesión (authenticated), por si el
-- cliente abre su tarjeta en un celular donde alguien inició sesión.
grant execute on function public.crear_canje(text) to anon, authenticated;
grant execute on function public.estado_canje(text, text) to anon, authenticated;
grant execute on function public.cancelar_canje(text, text) to anon, authenticated;

-- Las del mesero: solo con sesión; cada una revisa además el rol.
grant execute on function public.consultar_canje(text) to authenticated;
grant execute on function public.confirmar_canje(uuid) to authenticated;


-- ═══ 10. Comprobaciones finales ═══
do $$
declare
  v_funcion text;
begin
  -- Tablas con RLS.
  if not (select relrowsecurity from pg_class where oid = 'public.canjes'::regclass) then
    raise exception 'canjes debe tener RLS.';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.canje_intentos'::regclass) then
    raise exception 'canje_intentos debe tener RLS.';
  end if;

  -- anon no toca ninguna de las dos tablas.
  if has_table_privilege('anon', 'public.canjes', 'select, insert, update, delete')
     or has_any_column_privilege('anon', 'public.canjes', 'select') then
    raise exception 'anon no debe tener permisos sobre canjes.';
  end if;
  if has_table_privilege('anon', 'public.canje_intentos', 'select, insert, update, delete')
     or has_table_privilege('authenticated', 'public.canje_intentos', 'select, insert, update, delete')
     or has_any_column_privilege('authenticated', 'public.canje_intentos', 'select') then
    raise exception 'Nadie debe tener permisos sobre canje_intentos.';
  end if;

  -- authenticated: solo lectura, sin la columna codigo y sin escribir.
  if not has_column_privilege('authenticated', 'public.canjes', 'estado', 'select') then
    raise exception 'authenticated debe poder leer canjes.estado (dueño, Fase 4).';
  end if;
  if has_column_privilege('authenticated', 'public.canjes', 'codigo', 'select') then
    raise exception 'authenticated NO debe poder leer canjes.codigo.';
  end if;
  if has_table_privilege('authenticated', 'public.canjes', 'insert, update, delete') then
    raise exception 'authenticated no debe escribir directo en canjes.';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'canjes' and policyname = 'canjes_select_owner'
  ) or (select count(*) from pg_policies where schemaname = 'public' and tablename = 'canjes') <> 1 then
    raise exception 'canjes debe tener solo la política canjes_select_owner.';
  end if;

  -- Índices únicos de pendientes.
  if to_regclass('public.canjes_un_pendiente_por_cliente_uidx') is null
     or to_regclass('public.canjes_codigo_pendiente_uidx') is null then
    raise exception 'Faltan los índices únicos de canjes pendientes.';
  end if;

  -- Las 5 funciones: security definer y search_path vacío.
  foreach v_funcion in array array[
    'public.crear_canje(text)',
    'public.estado_canje(text, text)',
    'public.cancelar_canje(text, text)',
    'public.consultar_canje(text)',
    'public.confirmar_canje(uuid)'
  ] loop
    if not exists (
      select 1 from pg_proc
      where oid = to_regprocedure(v_funcion)
        and prosecdef
        and 'search_path=""' = any (proconfig)
    ) then
      raise exception '% debe ser security definer con search_path vacío.', v_funcion;
    end if;
  end loop;

  -- Permisos de ejecutar.
  if not has_function_privilege('anon', 'public.crear_canje(text)', 'execute')
     or not has_function_privilege('anon', 'public.estado_canje(text, text)', 'execute')
     or not has_function_privilege('anon', 'public.cancelar_canje(text, text)', 'execute')
     or not has_function_privilege('authenticated', 'public.crear_canje(text)', 'execute') then
    raise exception 'El cliente (anon y authenticated) debe poder ejecutar sus funciones.';
  end if;
  if has_function_privilege('anon', 'public.consultar_canje(text)', 'execute')
     or has_function_privilege('anon', 'public.confirmar_canje(uuid)', 'execute') then
    raise exception 'anon NO debe poder ejecutar consultar_canje ni confirmar_canje.';
  end if;
  if not has_function_privilege('authenticated', 'public.consultar_canje(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.confirmar_canje(uuid)', 'execute') then
    raise exception 'authenticated debe poder ejecutar consultar_canje y confirmar_canje.';
  end if;
end;
$$;


commit;


-- ═══════════════════════════════════════════════════════════════════════
-- PRUEBAS (correr DESPUÉS de aplicar lo de arriba)
-- ═══════════════════════════════════════════════════════════════════════
-- Copia UN bloque a la vez (de begin a rollback) en el editor SQL.
-- Todos terminan en rollback: no queda nada guardado.
-- El editor muestra solo el último resultado y se detiene en el primer error:
-- por eso cada caso es un bloque aparte.
--
-- Todos empiezan con la misma PREPARACIÓN:
--   - toma un negocio activo y a alguien con sesión en él (prefiere un mesero);
--   - crea a la clienta de prueba "Ana" (+52 998 000 0901) reclamando un
--     código, y guarda su token;
--   - le pone los puntos justos de la meta;
--   - borra el contador de intentos de ese usuario (dentro de la prueba).
-- Para actuar como mesero se usa:
--   set local role authenticated;
--   select set_config('request.jwt.claims', ...)   ← auth.uid() lee el "sub"
-- Para actuar como cliente sin sesión: set local role anon.
-- Para volver a ser administrador: reset role.
/*

-- ═══ PRUEBA 1: flujo completo ═══
-- Esperado: una fila con mismo_codigo = true, mesero_ve = "Ana ···0901",
-- estado_cliente = "entregado" y puntos_despues = 0.
begin;
select set_config('prueba.negocio', p.negocio_id::text, true),
       set_config('prueba.usuario', p.user_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where n.activo is true order by (p.role = 'mesero') desc, p.created_at limit 1;
insert into public.codigos (negocio_id, codigo, creado_por, expira_en)
values (current_setting('prueba.negocio')::uuid, 'prueba-canje-' || repeat('0', 28),
        current_setting('prueba.usuario')::uuid, now() + interval '10 minutes');
set local role anon;
select set_config('prueba.token', public.reclamar_codigo(
  'prueba-canje-' || repeat('0', 28), null, '9980000901', 'Ana')->>'token', true);
reset role;
update public.clientes set puntos_actuales = (select coalesce(n.meta_puntos, 10) from public.negocios n where n.id = negocio_id)
where negocio_id = current_setting('prueba.negocio')::uuid and telefono = '+529980000901';
delete from public.canje_intentos where usuario_id = current_setting('prueba.usuario')::uuid;
-- Cliente: crea el canje y vuelve a tocar (debe recibir el mismo código).
set local role anon;
select set_config('prueba.codigo', public.crear_canje(current_setting('prueba.token'))->>'codigo', true);
select set_config('prueba.mismo', (public.crear_canje(current_setting('prueba.token'))->>'codigo' = current_setting('prueba.codigo'))::text, true);
-- Mesero: consulta y confirma.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.usuario'), 'role', 'authenticated')::text, true);
select set_config('prueba.ficha', public.consultar_canje(current_setting('prueba.codigo'))::text, true);
select public.confirmar_canje((current_setting('prueba.ficha')::jsonb->>'canje_id')::uuid);
-- Cliente: ve "entregado" y su tarjeta con los puntos descontados.
set local role anon;
select current_setting('prueba.mismo') as mismo_codigo,
       (current_setting('prueba.ficha')::jsonb->>'nombre') || ' ···' || (current_setting('prueba.ficha')::jsonb->>'ultimos4') as mesero_ve,
       public.estado_canje(current_setting('prueba.token'), current_setting('prueba.codigo'))->>'estado' as estado_cliente,
       public.tarjeta_por_token(current_setting('prueba.token'))->>'puntos' as puntos_despues;
rollback;


-- ═══ PRUEBA 2: sin la meta completa ═══
-- Esperado: ERROR: PUNTOS_INSUFICIENTES
begin;
select set_config('prueba.negocio', p.negocio_id::text, true),
       set_config('prueba.usuario', p.user_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where n.activo is true order by (p.role = 'mesero') desc, p.created_at limit 1;
insert into public.codigos (negocio_id, codigo, creado_por, expira_en)
values (current_setting('prueba.negocio')::uuid, 'prueba-canje-' || repeat('0', 28),
        current_setting('prueba.usuario')::uuid, now() + interval '10 minutes');
set local role anon;
select set_config('prueba.token', public.reclamar_codigo(
  'prueba-canje-' || repeat('0', 28), null, '9980000901', 'Ana')->>'token', true);
-- Ana tiene 1 punto (el del reclamo).
select public.crear_canje(current_setting('prueba.token'));
rollback;


-- ═══ PRUEBA 3: confirmar dos veces el mismo canje ═══
-- Esperado: ERROR: CANJE_YA_ENTREGADO (y los puntos se descontaron una sola vez)
begin;
select set_config('prueba.negocio', p.negocio_id::text, true),
       set_config('prueba.usuario', p.user_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where n.activo is true order by (p.role = 'mesero') desc, p.created_at limit 1;
insert into public.codigos (negocio_id, codigo, creado_por, expira_en)
values (current_setting('prueba.negocio')::uuid, 'prueba-canje-' || repeat('0', 28),
        current_setting('prueba.usuario')::uuid, now() + interval '10 minutes');
set local role anon;
select set_config('prueba.token', public.reclamar_codigo(
  'prueba-canje-' || repeat('0', 28), null, '9980000901', 'Ana')->>'token', true);
reset role;
update public.clientes set puntos_actuales = (select coalesce(n.meta_puntos, 10) from public.negocios n where n.id = negocio_id)
where negocio_id = current_setting('prueba.negocio')::uuid and telefono = '+529980000901';
delete from public.canje_intentos where usuario_id = current_setting('prueba.usuario')::uuid;
set local role anon;
select set_config('prueba.codigo', public.crear_canje(current_setting('prueba.token'))->>'codigo', true);
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.usuario'), 'role', 'authenticated')::text, true);
select set_config('prueba.canje', public.consultar_canje(current_setting('prueba.codigo'))->>'canje_id', true);
select public.confirmar_canje(current_setting('prueba.canje')::uuid);
select public.confirmar_canje(current_setting('prueba.canje')::uuid);
rollback;


-- ═══ PRUEBA 4: el cliente cancela y el mesero intenta confirmar ═══
-- Esperado: ERROR: CANJE_CANCELADO
begin;
select set_config('prueba.negocio', p.negocio_id::text, true),
       set_config('prueba.usuario', p.user_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where n.activo is true order by (p.role = 'mesero') desc, p.created_at limit 1;
insert into public.codigos (negocio_id, codigo, creado_por, expira_en)
values (current_setting('prueba.negocio')::uuid, 'prueba-canje-' || repeat('0', 28),
        current_setting('prueba.usuario')::uuid, now() + interval '10 minutes');
set local role anon;
select set_config('prueba.token', public.reclamar_codigo(
  'prueba-canje-' || repeat('0', 28), null, '9980000901', 'Ana')->>'token', true);
reset role;
update public.clientes set puntos_actuales = (select coalesce(n.meta_puntos, 10) from public.negocios n where n.id = negocio_id)
where negocio_id = current_setting('prueba.negocio')::uuid and telefono = '+529980000901';
delete from public.canje_intentos where usuario_id = current_setting('prueba.usuario')::uuid;
set local role anon;
select set_config('prueba.codigo', public.crear_canje(current_setting('prueba.token'))->>'codigo', true);
-- El mesero ya tenía la ficha abierta...
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.usuario'), 'role', 'authenticated')::text, true);
select set_config('prueba.canje', public.consultar_canje(current_setting('prueba.codigo'))->>'canje_id', true);
-- ...y el cliente cancela antes de que confirme.
set local role anon;
select public.cancelar_canje(current_setting('prueba.token'), current_setting('prueba.codigo'));
set local role authenticated;
select public.confirmar_canje(current_setting('prueba.canje')::uuid);
rollback;


-- ═══ PRUEBA 5: canje caducado (lo que ven el cliente y el mesero) ═══
-- Esperado: una fila con cliente_ve = "caducado" y mesero_ve = {"estado": "caducado"}
begin;
select set_config('prueba.negocio', p.negocio_id::text, true),
       set_config('prueba.usuario', p.user_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where n.activo is true order by (p.role = 'mesero') desc, p.created_at limit 1;
insert into public.codigos (negocio_id, codigo, creado_por, expira_en)
values (current_setting('prueba.negocio')::uuid, 'prueba-canje-' || repeat('0', 28),
        current_setting('prueba.usuario')::uuid, now() + interval '10 minutes');
set local role anon;
select set_config('prueba.token', public.reclamar_codigo(
  'prueba-canje-' || repeat('0', 28), null, '9980000901', 'Ana')->>'token', true);
reset role;
update public.clientes set puntos_actuales = (select coalesce(n.meta_puntos, 10) from public.negocios n where n.id = negocio_id)
where negocio_id = current_setting('prueba.negocio')::uuid and telefono = '+529980000901';
delete from public.canje_intentos where usuario_id = current_setting('prueba.usuario')::uuid;
set local role anon;
select set_config('prueba.codigo', public.crear_canje(current_setting('prueba.token'))->>'codigo', true);
-- Se "adelanta el reloj": el canje se creó hace 6 minutos y caducó hace 1.
reset role;
update public.canjes set creado_en = now() - interval '6 minutes', expira_en = now() - interval '1 minute'
where negocio_id = current_setting('prueba.negocio')::uuid and codigo = current_setting('prueba.codigo') and estado = 'pendiente';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.usuario'), 'role', 'authenticated')::text, true);
select set_config('prueba.mesero_ve', public.consultar_canje(current_setting('prueba.codigo'))::text, true);
set local role anon;
select public.estado_canje(current_setting('prueba.token'), current_setting('prueba.codigo'))->>'estado' as cliente_ve,
       current_setting('prueba.mesero_ve') as mesero_ve;
rollback;


-- ═══ PRUEBA 6: confirmar un canje caducado ═══
-- Esperado: ERROR: CANJE_CADUCADO (los puntos no se tocan)
begin;
select set_config('prueba.negocio', p.negocio_id::text, true),
       set_config('prueba.usuario', p.user_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where n.activo is true order by (p.role = 'mesero') desc, p.created_at limit 1;
insert into public.codigos (negocio_id, codigo, creado_por, expira_en)
values (current_setting('prueba.negocio')::uuid, 'prueba-canje-' || repeat('0', 28),
        current_setting('prueba.usuario')::uuid, now() + interval '10 minutes');
set local role anon;
select set_config('prueba.token', public.reclamar_codigo(
  'prueba-canje-' || repeat('0', 28), null, '9980000901', 'Ana')->>'token', true);
reset role;
update public.clientes set puntos_actuales = (select coalesce(n.meta_puntos, 10) from public.negocios n where n.id = negocio_id)
where negocio_id = current_setting('prueba.negocio')::uuid and telefono = '+529980000901';
delete from public.canje_intentos where usuario_id = current_setting('prueba.usuario')::uuid;
set local role anon;
select set_config('prueba.codigo', public.crear_canje(current_setting('prueba.token'))->>'codigo', true);
-- El mesero abre la ficha a tiempo...
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.usuario'), 'role', 'authenticated')::text, true);
select set_config('prueba.canje', public.consultar_canje(current_setting('prueba.codigo'))->>'canje_id', true);
-- ...pero confirma cuando ya caducó.
reset role;
update public.canjes set creado_en = now() - interval '6 minutes', expira_en = now() - interval '1 minute'
where id = current_setting('prueba.canje')::uuid;
set local role authenticated;
select public.confirmar_canje(current_setting('prueba.canje')::uuid);
rollback;


-- ═══ PRUEBA 7: el cliente ya no tiene los puntos al confirmar ═══
-- Esperado: ERROR: PUNTOS_INSUFICIENTES
begin;
select set_config('prueba.negocio', p.negocio_id::text, true),
       set_config('prueba.usuario', p.user_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where n.activo is true order by (p.role = 'mesero') desc, p.created_at limit 1;
insert into public.codigos (negocio_id, codigo, creado_por, expira_en)
values (current_setting('prueba.negocio')::uuid, 'prueba-canje-' || repeat('0', 28),
        current_setting('prueba.usuario')::uuid, now() + interval '10 minutes');
set local role anon;
select set_config('prueba.token', public.reclamar_codigo(
  'prueba-canje-' || repeat('0', 28), null, '9980000901', 'Ana')->>'token', true);
reset role;
update public.clientes set puntos_actuales = (select coalesce(n.meta_puntos, 10) from public.negocios n where n.id = negocio_id)
where negocio_id = current_setting('prueba.negocio')::uuid and telefono = '+529980000901';
delete from public.canje_intentos where usuario_id = current_setting('prueba.usuario')::uuid;
set local role anon;
select set_config('prueba.codigo', public.crear_canje(current_setting('prueba.token'))->>'codigo', true);
reset role;
update public.clientes set puntos_actuales = 0
where negocio_id = current_setting('prueba.negocio')::uuid and telefono = '+529980000901';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.usuario'), 'role', 'authenticated')::text, true);
select public.confirmar_canje((public.consultar_canje(current_setting('prueba.codigo'))->>'canje_id')::uuid);
rollback;


-- ═══ PRUEBA 8: 5 códigos incorrectos seguidos ═══
-- Esperado (primer resultado, si quitas el último select): 5 filas con
-- intentos_restantes 4, 3, 2, 1, 0; la última con "bloqueado_segundos": 300.
-- Esperado (con el último select): ERROR: DEMASIADOS_INTENTOS (DETAIL: ~300)
begin;
select set_config('prueba.negocio', p.negocio_id::text, true),
       set_config('prueba.usuario', p.user_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where n.activo is true order by (p.role = 'mesero') desc, p.created_at limit 1;
delete from public.canje_intentos where usuario_id = current_setting('prueba.usuario')::uuid;
-- 5 códigos que ningún canje del negocio usó en los últimos 15 minutos.
select set_config('prueba.malos', string_agg(c, ','), true)
from (
  select lpad(g::text, 4, '0') as c
  from generate_series(0, 9999) g
  where not exists (
    select 1 from public.canjes x
    where x.negocio_id = current_setting('prueba.negocio')::uuid
      and x.codigo = lpad(g::text, 4, '0')
      and x.creado_en > now() - interval '15 minutes'
  )
  order by g limit 5
) t;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.usuario'), 'role', 'authenticated')::text, true);
select c as codigo, public.consultar_canje(c) as respuesta
from unnest(string_to_array(current_setting('prueba.malos'), ',')) with ordinality as t(c, n)
order by n;
select public.consultar_canje('0000');
rollback;


-- ═══ PRUEBA 9: sin sesión no se puede consultar ni confirmar ═══
-- Esperado: ERROR: permission denied for function consultar_canje
begin;
set local role anon;
select public.consultar_canje('1234');
rollback;


-- ═══ PRUEBA 10: sin sesión no se lee la tabla canjes ═══
-- Esperado: ERROR: permission denied for table canjes
begin;
set local role anon;
select count(*) from public.canjes;
rollback;


-- ═══ PRUEBA 11: el dueño ve el canje entregado, sin el código ═══
-- Usa a un DUEÑO (no a un mesero) para confirmar y leer.
-- Esperado: una fila con estado "entregado", el premio, los puntos
-- descontados y confirmado_por = el id del dueño.
-- (Si cambias la última consulta por "select codigo from public.canjes",
--  esperado: ERROR: permission denied for table canjes.)
begin;
select set_config('prueba.negocio', p.negocio_id::text, true),
       set_config('prueba.usuario', p.user_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where n.activo is true and p.role = 'owner' order by p.created_at limit 1;
insert into public.codigos (negocio_id, codigo, creado_por, expira_en)
values (current_setting('prueba.negocio')::uuid, 'prueba-canje-' || repeat('0', 28),
        current_setting('prueba.usuario')::uuid, now() + interval '10 minutes');
set local role anon;
select set_config('prueba.token', public.reclamar_codigo(
  'prueba-canje-' || repeat('0', 28), null, '9980000901', 'Ana')->>'token', true);
reset role;
update public.clientes set puntos_actuales = (select coalesce(n.meta_puntos, 10) from public.negocios n where n.id = negocio_id)
where negocio_id = current_setting('prueba.negocio')::uuid and telefono = '+529980000901';
delete from public.canje_intentos where usuario_id = current_setting('prueba.usuario')::uuid;
set local role anon;
select set_config('prueba.codigo', public.crear_canje(current_setting('prueba.token'))->>'codigo', true);
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.usuario'), 'role', 'authenticated')::text, true);
-- Mientras está pendiente, el dueño NO lo ve (0 filas).
select set_config('prueba.visibles_pendiente', (select count(*) from public.canjes c
  join public.clientes cl on cl.id = c.cliente_id where cl.telefono = '+529980000901')::text, true);
select set_config('prueba.canje', public.consultar_canje(current_setting('prueba.codigo'))->>'canje_id', true);
select public.confirmar_canje(current_setting('prueba.canje')::uuid);
select current_setting('prueba.visibles_pendiente') as visibles_mientras_pendiente,
       estado, premio_texto, puntos_descontados, confirmado_por, confirmado_en
from public.canjes
where id = current_setting('prueba.canje')::uuid;
rollback;

*/
