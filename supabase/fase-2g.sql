-- Fase 2G (parte A): configuración del dueño y limpieza de funciones viejas.
-- Las llama el panel del dueño CON sesión (rol authenticated).
-- Todo va en UNA transacción: si cualquier paso falla, no se aplica nada.
-- Correr completo en el editor SQL de Supabase.
--
-- Errores que verá la app (en error.message):
--   'Acceso denegado'       no hay sesión o el usuario no es dueño de un negocio
--   'NEGOCIO_INACTIVO'      el negocio está desactivado
--   'META_INVALIDA'         visitas para el premio fuera de 1 a 100
--   'PREMIO_INVALIDO'       premio vacío o de más de 80 caracteres
--   'MAX_CODIGOS_INVALIDO'  códigos activos por mesero fuera de 1 a 50
--   'TELEFONO_INVALIDO'     no es un número de México de 10 dígitos
--   'NO_ENCONTRADO'         el número del personal no existe en este negocio
--
-- El negocio SIEMPRE sale de la sesión (profiles), nunca de un parámetro:
-- un dueño no puede cambiar el programa ni la lista de otro negocio.
-- No toca negocios.reset_token ni negocios.reset_expira.

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
end;
$$;


-- ═══ 1. guardar_programa(meta, premio, códigos activos) ═══
-- Sección "Programa" del panel del dueño.
-- Notas de negocio:
--   - Si baja la meta, los clientes que ya tengan esos puntos quedan con
--     premio listo (lo verán en su tarjeta y el mesero en el aviso).
--   - Si baja el límite de códigos, los que ya están activos siguen
--     sirviendo; el mesero no podrá crear más hasta quedar por debajo.
create or replace function public.guardar_programa(
  p_meta_puntos integer,
  p_premio text,
  p_max_codigos_activos integer
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

  update public.negocios
  set meta_puntos = p_meta_puntos,
      premio = v_premio,
      max_codigos_activos = p_max_codigos_activos
  where id = v_negocio.id
  returning * into v_negocio;

  return jsonb_build_object(
    'meta_puntos', v_negocio.meta_puntos,
    'premio', v_negocio.premio,
    'max_codigos_activos', v_negocio.max_codigos_activos
  );
end;
$$;


-- ═══ 2. agregar_numero_excluido(teléfono) ═══
-- Sección "Personal (no ganan puntos)". Se guarda en E.164 (+52 y 10 dígitos).
-- Si el número ya estaba, no falla: devuelve el que existe con ya_existia = true.
-- Excluir un número no quita los puntos que ya tenía; solo impide sumar más
-- (reclamar_codigo revisa la lista en cada reclamo, también con token).
create or replace function public.agregar_numero_excluido(p_telefono text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio public.negocios%rowtype;
  v_telefono text;
  v_fila public.numeros_excluidos%rowtype;
  v_ya_existia boolean := false;
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

  v_telefono := public.normalizar_telefono_mx(p_telefono);
  if v_telefono is null then
    raise exception 'TELEFONO_INVALIDO';
  end if;

  insert into public.numeros_excluidos (negocio_id, telefono)
  values (v_negocio.id, v_telefono)
  on conflict (negocio_id, telefono) do nothing
  returning * into v_fila;

  if v_fila.id is null then
    v_ya_existia := true;
    select e.* into v_fila
    from public.numeros_excluidos e
    where e.negocio_id = v_negocio.id and e.telefono = v_telefono;
  end if;

  return jsonb_build_object(
    'id', v_fila.id,
    'telefono', v_fila.telefono,
    'creado_en', v_fila.creado_en,
    'ya_existia', v_ya_existia
  );
end;
$$;


-- ═══ 3. quitar_numero_excluido(id) ═══
-- Solo borra si el número es del negocio del dueño que llama.
create or replace function public.quitar_numero_excluido(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio public.negocios%rowtype;
  v_id uuid;
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

  delete from public.numeros_excluidos e
  where e.id = p_id and e.negocio_id = v_negocio.id
  returning e.id into v_id;

  if v_id is null then
    raise exception 'NO_ENCONTRADO';
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;


-- ═══ 4. Permisos de las funciones nuevas ═══
-- Supabase da permiso de ejecutar a todos por defecto. Se quita y se da
-- solo a usuarios con sesión; cada función revisa además que sea el dueño.
revoke all on function public.guardar_programa(integer, text, integer) from public, anon, authenticated;
revoke all on function public.agregar_numero_excluido(text) from public, anon, authenticated;
revoke all on function public.quitar_numero_excluido(uuid) from public, anon, authenticated;

grant execute on function public.guardar_programa(integer, text, integer) to authenticated;
grant execute on function public.agregar_numero_excluido(text) to authenticated;
grant execute on function public.quitar_numero_excluido(uuid) to authenticated;


-- ═══ 5. Detenerse si otra función usa las que se van a borrar ═══
-- Postgres no registra estas dependencias dentro de funciones plpgsql/sql:
-- el borrado no falla, pero la función que las usa truena al llamarse.
-- get_kiosk_progress (usa public_get_customer_card) también se borra abajo,
-- por eso no cuenta. Si aparece cualquier otra, no se aplica nada.
do $$
declare
  r record;
begin
  for r in
    select p.proname
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.prosrc ~ '(record_visit_temporary|public_register_customer|public_customer_exists|public_get_customer_card)'
      and p.proname not in ('record_visit_temporary', 'public_register_customer',
                            'public_customer_exists', 'public_get_customer_card',
                            'get_kiosk_progress')
  loop
    raise exception 'La función % usa una función que se borra en este archivo. Revísala antes de seguir.', r.proname;
  end loop;
end;
$$;


-- ═══ 6. Borrar las funciones viejas por teléfono ═══
-- La app ya no las usa (parte B de 2G):
--   record_visit_temporary    → la reemplaza reclamar_codigo (y visita_manual en 2H)
--   public_register_customer  → alta sin compra; solo se crean clientes al reclamar
--   public_customer_exists    → permitía averiguar si un número es cliente
--   public_get_customer_card  → tarjetas ajenas por teléfono; la reemplaza tarjeta_por_token
drop function if exists public.record_visit_temporary(uuid);
drop function if exists public.public_register_customer(uuid, text, text);
drop function if exists public.public_customer_exists(uuid, text);
drop function if exists public.public_get_customer_card(uuid, text);

-- get_kiosk_progress llamaba a public_get_customer_card y buscaba clientes por
-- teléfono sin límite de intentos. La pantalla #/kiosko se quitó de la app
-- (decisión del 2G); el "Modo mostrador" queda para después (ver CLAUDE.md).
drop function if exists public.get_kiosk_progress(text);


-- ═══ 7. Comprobaciones finales ═══
do $$
begin
  if to_regprocedure('public.public_get_customer_card(uuid, text)') is not null
     or to_regprocedure('public.public_customer_exists(uuid, text)') is not null
     or to_regprocedure('public.public_register_customer(uuid, text, text)') is not null
     or to_regprocedure('public.record_visit_temporary(uuid)') is not null
     or to_regprocedure('public.get_kiosk_progress(text)') is not null then
    raise exception 'Quedó una función vieja sin borrar.';
  end if;
  if has_function_privilege('anon', 'public.guardar_programa(integer, text, integer)', 'execute')
     or has_function_privilege('anon', 'public.agregar_numero_excluido(text)', 'execute')
     or has_function_privilege('anon', 'public.quitar_numero_excluido(uuid)', 'execute') then
    raise exception 'anon no debe poder ejecutar las funciones del dueño.';
  end if;
  if not has_function_privilege('authenticated', 'public.guardar_programa(integer, text, integer)', 'execute') then
    raise exception 'authenticated debe poder ejecutar guardar_programa.';
  end if;
end;
$$;


commit;
