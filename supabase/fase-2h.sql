-- Fase 2H: captura manual (plan B).
-- El mesero teclea el número cuando el cliente no puede escanear el QR.
-- La llama la pantalla del mesero CON sesión (rol authenticated).
-- Todo va en UNA transacción: si cualquier paso falla, no se aplica nada.
-- Correr completo en el editor SQL de Supabase.
--
-- Errores que verá la app (en error.message):
--   'Acceso denegado'    sin sesión o sin rol de mesero/dueño
--   'NEGOCIO_INACTIVO'   el negocio está desactivado
--   'LIMITE_MANUALES'    el mesero llegó a max_manuales_dia hoy
--                        (detail = 'desactivada' si el negocio la tiene en 0)
--   'TELEFONO_INVALIDO'  no es un número de México de 10 dígitos
--   'NUMERO_EXCLUIDO'    número del personal: no gana puntos
--   'NOMBRE_INVALIDO'    cliente nuevo sin un primer nombre utilizable
--   'YA_SUMO_HOY'        el cliente llegó al límite de visitas del día
-- En todos estos errores la transacción se revierte: no se crea el cliente
-- ni se guarda la visita.
--
-- Mismas reglas que reclamar_codigo (2C). La diferencia: no hay código, la
-- visita queda con origen = 'manual' y mesero_id = quien la captura, y cada
-- mesero tiene un tope diario de capturas (antifraude: el reporte por mesero
-- compara códigos generados, reclamados y capturas manuales).

begin;


-- ═══ 0. Comprobaciones previas ═══
do $$
begin
  if to_regclass('public.numeros_excluidos') is null
     or to_regprocedure('public.normalizar_telefono_mx(text)') is null then
    raise exception 'Falta la fase 2A.';
  end if;
  if to_regprocedure('public.user_has_business_role(uuid, text[])') is null then
    raise exception 'Falta user_has_business_role (fase 3).';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'visitas' and column_name = 'dia_local'
  ) then
    raise exception 'Falta visitas.dia_local (fase 2A).';
  end if;
end;
$$;


-- ═══ 1. negocios.max_manuales_dia ═══
-- Tope de capturas manuales por mesero al día. 10 por defecto; 0 la desactiva.
-- negocios usa permisos por columna: hay que dar lectura explícita.
-- Nadie la modifica directo (se agregará a guardar_programa cuando el dueño
-- necesite cambiarla desde el panel).
alter table public.negocios
  add column if not exists max_manuales_dia integer not null default 10;

alter table public.negocios
  drop constraint if exists negocios_max_manuales_dia_rango,
  add constraint negocios_max_manuales_dia_rango check (max_manuales_dia between 0 and 100);

grant select (max_manuales_dia) on public.negocios to authenticated;

-- Para contar rápido las capturas de un mesero en un día.
create index if not exists visitas_mesero_manual_dia_idx
on public.visitas (mesero_id, dia_local)
where origen = 'manual';


-- ═══ 2. visita_manual(teléfono, nombre) ═══
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
    and v.dia_local = v_hoy;

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


-- ═══ 3. Permisos ═══
-- Supabase da permiso de ejecutar a todos por defecto. Se quita y se da
-- solo a usuarios con sesión; la función revisa además el rol.
revoke all on function public.visita_manual(text, text) from public, anon, authenticated;
grant execute on function public.visita_manual(text, text) to authenticated;


-- ═══ 4. Comprobaciones finales ═══
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'negocios'
      and column_name = 'max_manuales_dia' and column_default = '10'
  ) then
    raise exception 'Falta negocios.max_manuales_dia con valor por defecto 10.';
  end if;
  if not has_column_privilege('authenticated', 'public.negocios', 'max_manuales_dia', 'select') then
    raise exception 'authenticated debe poder leer negocios.max_manuales_dia.';
  end if;
  if has_function_privilege('anon', 'public.visita_manual(text, text)', 'execute') then
    raise exception 'anon no debe poder ejecutar visita_manual.';
  end if;
  if not has_function_privilege('authenticated', 'public.visita_manual(text, text)', 'execute') then
    raise exception 'authenticated debe poder ejecutar visita_manual.';
  end if;
end;
$$;


commit;
