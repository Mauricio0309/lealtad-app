-- ═══════════════════════════════════════════════════════════════════════
-- Fase 8: logros del dueño (se celebran una sola vez)
-- ═══════════════════════════════════════════════════════════════════════
-- Hitos:
--   clientes   clientes registrados       10, 25, 50, 100, 250, 500, 1000
--   regresos   clientes que ya regresaron  1, 5, 10, 25, 50, 100, 250
-- Los conteos salen de public.resumen_inicio() (clientes_registrados y
-- clientes_regresaron), así que siempre coinciden con lo que ve en el Resumen.
--
-- Objetos nuevos (este archivo NO modifica nada existente):
--   tabla   logros_celebrados   cerrada: RLS sin policies, sin permisos.
--   1. logros_hitos()           lista fija de hitos (interna, nadie la llama).
--   2. logros_pendientes()      [{tipo, hito}] alcanzados y sin celebrar.
--   3. celebrar_logro(tipo, hito)  marca ese hito y los menores del tipo.
--   4. logros_lista()           celebrados + próximo hito de cada tipo.
--
-- Por qué así:
--   - La tabla está cerrada y solo se escribe desde celebrar_logro, que
--     valida en el servidor que el hito sí esté alcanzado. El navegador no
--     puede "regalarse" logros ni ver los de otro negocio.
--   - Celebrar un hito marca también los menores: si un negocio llega de
--     golpe a 30 clientes (o la app estuvo cerrada), se celebra solo el
--     mayor y no aparecen tres festejos seguidos.
--   - Es idempotente (on conflict do nothing): dos pestañas o un doble
--     toque no fallan ni duplican.
--   - Ninguna respuesta lleva nombres ni teléfonos: solo tipos, hitos y fechas.
--
-- Errores (igual que el resto del panel):
--   'Acceso denegado'      sin sesión válida, no es dueño o está desactivado
--   'NEGOCIO_INACTIVO'     el negocio está desactivado
--   'LOGRO_INVALIDO'       tipo u hito que no está en la lista
--   'LOGRO_NO_ALCANZADO'   el conteo actual todavía no llega a ese hito

begin;


-- ═══ 0. Comprobaciones previas ═══
do $$
begin
  if to_regprocedure('public.user_has_business_role(uuid, text[])') is null then
    raise exception 'Falta public.user_has_business_role (fase 4C).';
  end if;
  if to_regprocedure('public.resumen_inicio()') is null then
    raise exception 'Falta public.resumen_inicio() (fase 7): aplicar fase-7-resumen.sql primero.';
  end if;
  if to_regclass('public.logros_celebrados') is not null
     or to_regprocedure('public.logros_hitos()') is not null
     or to_regprocedure('public.logros_pendientes()') is not null
     or to_regprocedure('public.celebrar_logro(text, integer)') is not null
     or to_regprocedure('public.logros_lista()') is not null then
    raise exception 'La fase 8 ya está (parcialmente) aplicada: este archivo solo agrega.';
  end if;
end;
$$;

-- Huella de resumen_inicio para comprobar al final que no se tocó.
select set_config('fase8.huella', (
  select md5(prosrc) from pg_proc where oid = to_regprocedure('public.resumen_inicio()')
), true);


-- ═══ Tabla logros_celebrados ═══
create table public.logros_celebrados (
  negocio_id   uuid not null references public.negocios on delete cascade,
  tipo         text not null check (tipo in ('clientes', 'regresos')),
  hito         integer not null,
  celebrado_en timestamptz not null default now(),
  primary key (negocio_id, tipo, hito)
);

comment on table public.logros_celebrados is
  'Hitos que el dueño ya celebró. Cerrada: solo se escribe con celebrar_logro().';

-- RLS activado y SIN policies: nadie la lee ni la escribe directo.
alter table public.logros_celebrados enable row level security;
revoke all on table public.logros_celebrados from public, anon, authenticated;


-- ═══ 1. logros_hitos() ═══
-- Única fuente de los hitos. Interna: solo la usan las funciones de abajo
-- (que corren como su dueño), por eso no se le da permiso a nadie.
create function public.logros_hitos()
returns table (tipo text, hito integer)
language sql
immutable
set search_path = ''
as $$
  select 'clientes'::text, x from unnest(array[10, 25, 50, 100, 250, 500, 1000]) as x
  union all
  select 'regresos'::text, x from unnest(array[1, 5, 10, 25, 50, 100, 250]) as x;
$$;

revoke all on function public.logros_hitos() from public, anon, authenticated;


-- ═══ 2. logros_pendientes() ═══
-- Hitos ya alcanzados que el dueño no ha celebrado, ordenados por tipo y
-- hito: [{"tipo": "clientes", "hito": 10}, ...]. Vacío: [].
create function public.logros_pendientes()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio_id uuid;
  v_activo boolean;
  v_resumen jsonb;
  v_clientes integer;
  v_regresos integer;
  v_pendientes jsonb;
begin
  -- Solo el dueño, y solo de su negocio (sale de la sesión).
  select n.id, n.activo into v_negocio_id, v_activo
  from public.profiles p
  join public.negocios n on n.id = p.negocio_id
  where p.user_id = auth.uid() and p.role = 'owner';

  if v_negocio_id is null
     or not public.user_has_business_role(v_negocio_id, array['owner']) then
    raise exception 'Acceso denegado';
  end if;
  if v_activo is not true then
    raise exception 'NEGOCIO_INACTIVO';
  end if;

  -- Los mismos números del Resumen.
  v_resumen  := public.resumen_inicio();
  v_clientes := coalesce((v_resumen->>'clientes_registrados')::integer, 0);
  v_regresos := coalesce((v_resumen->>'clientes_regresaron')::integer, 0);

  select coalesce(jsonb_agg(jsonb_build_object('tipo', h.tipo, 'hito', h.hito)
                            order by h.tipo, h.hito), '[]'::jsonb)
  into v_pendientes
  from public.logros_hitos() h
  where h.hito <= case h.tipo when 'clientes' then v_clientes else v_regresos end
    and not exists (
      select 1 from public.logros_celebrados lc
      where lc.negocio_id = v_negocio_id
        and lc.tipo = h.tipo
        and lc.hito = h.hito
    );

  return v_pendientes;
end;
$$;

revoke all on function public.logros_pendientes() from public, anon, authenticated;
grant execute on function public.logros_pendientes() to authenticated;


-- ═══ 3. celebrar_logro(p_tipo, p_hito) ═══
-- Valida que el hito exista y esté alcanzado HOY (con los números del
-- Resumen) y lo guarda junto con los menores del mismo tipo que falten.
-- Idempotente. Devuelve {"tipo", "hito", "nuevos": filas insertadas}.
create function public.celebrar_logro(p_tipo text, p_hito integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_negocio_id uuid;
  v_activo boolean;
  v_resumen jsonb;
  v_conteo integer;
  v_nuevos integer;
begin
  select n.id, n.activo into v_negocio_id, v_activo
  from public.profiles p
  join public.negocios n on n.id = p.negocio_id
  where p.user_id = auth.uid() and p.role = 'owner';

  if v_negocio_id is null
     or not public.user_has_business_role(v_negocio_id, array['owner']) then
    raise exception 'Acceso denegado';
  end if;
  if v_activo is not true then
    raise exception 'NEGOCIO_INACTIVO';
  end if;

  if p_tipo is null or p_hito is null or not exists (
    select 1 from public.logros_hitos() h where h.tipo = p_tipo and h.hito = p_hito
  ) then
    raise exception 'LOGRO_INVALIDO';
  end if;

  v_resumen := public.resumen_inicio();
  v_conteo := coalesce(case p_tipo
    when 'clientes' then (v_resumen->>'clientes_registrados')::integer
    else (v_resumen->>'clientes_regresaron')::integer
  end, 0);

  if p_hito > v_conteo then
    raise exception 'LOGRO_NO_ALCANZADO';
  end if;

  insert into public.logros_celebrados (negocio_id, tipo, hito)
  select v_negocio_id, h.tipo, h.hito
  from public.logros_hitos() h
  where h.tipo = p_tipo and h.hito <= p_hito
  on conflict (negocio_id, tipo, hito) do nothing;

  get diagnostics v_nuevos = row_count;

  return jsonb_build_object('tipo', p_tipo, 'hito', p_hito, 'nuevos', v_nuevos);
end;
$$;

revoke all on function public.celebrar_logro(text, integer) from public, anon, authenticated;
grant execute on function public.celebrar_logro(text, integer) to authenticated;


-- ═══ 4. logros_lista() ═══
-- {
--   "celebrados": [{"tipo", "hito", "celebrado_en"}, ...]  (más antiguo primero)
--   "proximo":    {"clientes": 25, "regresos": 5}          (null si ya pasó el último)
-- }
create function public.logros_lista()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio_id uuid;
  v_activo boolean;
  v_resumen jsonb;
  v_clientes integer;
  v_regresos integer;
  v_celebrados jsonb;
begin
  select n.id, n.activo into v_negocio_id, v_activo
  from public.profiles p
  join public.negocios n on n.id = p.negocio_id
  where p.user_id = auth.uid() and p.role = 'owner';

  if v_negocio_id is null
     or not public.user_has_business_role(v_negocio_id, array['owner']) then
    raise exception 'Acceso denegado';
  end if;
  if v_activo is not true then
    raise exception 'NEGOCIO_INACTIVO';
  end if;

  v_resumen  := public.resumen_inicio();
  v_clientes := coalesce((v_resumen->>'clientes_registrados')::integer, 0);
  v_regresos := coalesce((v_resumen->>'clientes_regresaron')::integer, 0);

  select coalesce(jsonb_agg(jsonb_build_object(
           'tipo', lc.tipo, 'hito', lc.hito, 'celebrado_en', lc.celebrado_en)
           order by lc.celebrado_en, lc.tipo, lc.hito), '[]'::jsonb)
  into v_celebrados
  from public.logros_celebrados lc
  where lc.negocio_id = v_negocio_id;

  return jsonb_build_object(
    'celebrados', v_celebrados,
    'proximo', jsonb_build_object(
      'clientes', (select min(h.hito) from public.logros_hitos() h
                   where h.tipo = 'clientes' and h.hito > v_clientes),
      'regresos', (select min(h.hito) from public.logros_hitos() h
                   where h.tipo = 'regresos' and h.hito > v_regresos)
    )
  );
end;
$$;

revoke all on function public.logros_lista() from public, anon, authenticated;
grant execute on function public.logros_lista() to authenticated;


-- ═══ 5. Verificación final (si algo falla, se deshace todo) ═══
do $$
declare
  v_funcion text;
begin
  -- Tabla cerrada: RLS activo, cero policies, cero permisos.
  if not (select relrowsecurity from pg_class where oid = 'public.logros_celebrados'::regclass) then
    raise exception 'logros_celebrados debe tener RLS activado.';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'logros_celebrados') then
    raise exception 'logros_celebrados no debe tener policies.';
  end if;
  if has_table_privilege('anon', 'public.logros_celebrados', 'select, insert, update, delete')
     or has_table_privilege('authenticated', 'public.logros_celebrados', 'select, insert, update, delete') then
    raise exception 'anon/authenticated no deben tener permisos sobre logros_celebrados.';
  end if;

  -- La lista interna no la ejecuta nadie desde fuera.
  if has_function_privilege('anon', 'public.logros_hitos()', 'execute')
     or has_function_privilege('authenticated', 'public.logros_hitos()', 'execute') then
    raise exception 'logros_hitos() debe ser interna.';
  end if;

  foreach v_funcion in array array[
    'public.logros_pendientes()',
    'public.celebrar_logro(text, integer)',
    'public.logros_lista()'
  ] loop
    if not exists (
      select 1 from pg_proc
      where oid = to_regprocedure(v_funcion)
        and prosecdef
        and 'search_path=""' = any (proconfig)
    ) then
      raise exception '% debe ser security definer con search_path vacío.', v_funcion;
    end if;
    if position('user_has_business_role' in (select prosrc from pg_proc where oid = to_regprocedure(v_funcion))) = 0
       or position('NEGOCIO_INACTIVO' in (select prosrc from pg_proc where oid = to_regprocedure(v_funcion))) = 0 then
      raise exception '% debe comprobar dueño y negocio activo.', v_funcion;
    end if;
    if has_function_privilege('anon', v_funcion, 'execute') then
      raise exception 'anon NO debe poder ejecutar %.', v_funcion;
    end if;
    if not has_function_privilege('authenticated', v_funcion, 'execute') then
      raise exception 'authenticated debe poder ejecutar %.', v_funcion;
    end if;
  end loop;

  -- resumen_inicio quedó idéntica.
  if nullif(current_setting('fase8.huella', true), '') is null then
    raise exception 'No se encontró la huella inicial (fase8.huella): correr el archivo completo de una vez.';
  end if;
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.resumen_inicio()'))
     is distinct from current_setting('fase8.huella') then
    raise exception 'Se modificó resumen_inicio(): este archivo solo agrega.';
  end if;
end;
$$;


commit;


-- ═══════════════════════════════════════════════════════════════════════
-- PRUEBAS (después de aplicar; terminan en rollback, no dejan rastro)
-- ═══════════════════════════════════════════════════════════════════════
-- Usa el negocio real "dopamina" (9f98217b-056b-419e-beeb-99315fd48a26) y
-- su dueño. Dentro de la transacción borra sus logros celebrados para
-- empezar de cero; el rollback los regresa. No toca clientes ni visitas.
-- Todo en un solo DO (sin tablas temporales). Cambia de rol con set local.
-- Esperado: hasta 8 NOTICE, el último "OK: fase 8 pasó todas las pruebas".
-- Si algo falla: ERROR "FALLÓ ...".
/*

begin;
do $$
declare
  v_negocio constant uuid := '9f98217b-056b-419e-beeb-99315fd48a26';
  v_dueno uuid;
  v_mesero uuid;
  v_resumen jsonb;
  v_conteos jsonb;
  v_esperado jsonb;
  v_tipo text;
  v_mayor integer;
  v_siguiente integer;
  v_menores integer;
  r jsonb;
  v_err text;
  v_celebrados integer := 0;
begin
  select p.user_id into v_dueno
  from public.profiles p
  where p.negocio_id = v_negocio and p.role = 'owner' and p.activo
  order by p.created_at limit 1;
  if v_dueno is null then raise exception 'FALLÓ 0: dopamina no tiene dueño activo.'; end if;

  select p.user_id into v_mesero
  from public.profiles p
  where p.role = 'mesero' and p.activo
  order by (p.negocio_id = v_negocio) desc, p.created_at limit 1;

  -- Empezar sin logros (como postgres; el rollback los regresa).
  delete from public.logros_celebrados where negocio_id = v_negocio;

  -- Entrar como el dueño de dopamina.
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_dueno, 'role', 'authenticated')::text, true);

  -- 1. Pendientes = todos los hitos que ya alcanzó (nada celebrado aún).
  v_resumen := public.resumen_inicio();
  v_conteos := jsonb_build_object(
    'clientes', (v_resumen->>'clientes_registrados')::integer,
    'regresos', (v_resumen->>'clientes_regresaron')::integer);
  select coalesce(jsonb_agg(jsonb_build_object('tipo', h.tipo, 'hito', h.hito)
                            order by h.tipo, h.hito), '[]'::jsonb)
  into v_esperado
  from (
    select 'clientes' as tipo, x as hito from unnest(array[10, 25, 50, 100, 250, 500, 1000]) x
    union all
    select 'regresos', x from unnest(array[1, 5, 10, 25, 50, 100, 250]) x
  ) h
  where h.hito <= (v_conteos->>h.tipo)::integer;
  r := public.logros_pendientes();
  if r is distinct from v_esperado then
    raise exception 'FALLÓ 1: pendientes esperaba % con conteos %, salió %', v_esperado, v_conteos, r;
  end if;
  raise notice '1 pendientes OK (conteos %: %)', v_conteos, r;

  foreach v_tipo in array array['clientes', 'regresos'] loop
    select max((e->>'hito')::integer), count(*) into v_mayor, v_menores
    from jsonb_array_elements(v_esperado) e where e->>'tipo' = v_tipo;

    -- 2. Celebrar el mayor alcanzado marca también los menores; repetirlo
    --    (o celebrar uno menor) no inserta nada.
    if v_mayor is not null then
      r := public.celebrar_logro(v_tipo, v_mayor);
      if (r->>'nuevos')::integer <> v_menores then
        raise exception 'FALLÓ 2a (%): esperaba % nuevos: %', v_tipo, v_menores, r;
      end if;
      r := public.celebrar_logro(v_tipo, v_mayor);
      if (r->>'nuevos')::integer <> 0 then raise exception 'FALLÓ 2b (%): no es idempotente: %', v_tipo, r; end if;
      r := public.celebrar_logro(v_tipo, (select min((e->>'hito')::integer) from jsonb_array_elements(v_esperado) e where e->>'tipo' = v_tipo));
      if (r->>'nuevos')::integer <> 0 then raise exception 'FALLÓ 2c (%): el menor ya estaba celebrado: %', v_tipo, r; end if;
      if exists (select 1 from jsonb_array_elements(public.logros_pendientes()) e where e->>'tipo' = v_tipo) then
        raise exception 'FALLÓ 2d (%): quedaron pendientes después de celebrar.', v_tipo;
      end if;
      v_celebrados := v_celebrados + v_menores;
      raise notice '2 % celebrar % y repetir OK (% nuevos, luego 0)', v_tipo, v_mayor, v_menores;
    else
      raise notice '2 % sin hitos alcanzados: no hay qué celebrar', v_tipo;
    end if;

    -- 3. El siguiente hito todavía no se puede celebrar.
    select min(h.hito) into v_siguiente
    from (
      select 'clientes' as tipo, x as hito from unnest(array[10, 25, 50, 100, 250, 500, 1000]) x
      union all
      select 'regresos', x from unnest(array[1, 5, 10, 25, 50, 100, 250]) x
    ) h
    where h.tipo = v_tipo and h.hito > (v_conteos->>v_tipo)::integer;
    if v_siguiente is not null then
      v_err := null;
      begin perform public.celebrar_logro(v_tipo, v_siguiente); exception when others then v_err := sqlerrm; end;
      if v_err is distinct from 'LOGRO_NO_ALCANZADO' then
        raise exception 'FALLÓ 3 (%): hito % esperaba LOGRO_NO_ALCANZADO, salió %', v_tipo, v_siguiente, coalesce(v_err, '(sin error)');
      end if;
    end if;
    if (public.logros_lista()->'proximo'->>v_tipo)::integer is distinct from v_siguiente then
      raise exception 'FALLÓ 3b (%): próximo esperaba %: %', v_tipo, v_siguiente, public.logros_lista();
    end if;
  end loop;

  -- 4. Tipo u hito fuera de la lista.
  v_err := null;
  begin perform public.celebrar_logro('visitas', 10); exception when others then v_err := sqlerrm; end;
  if v_err is distinct from 'LOGRO_INVALIDO' then raise exception 'FALLÓ 4a: tipo inválido salió %', coalesce(v_err, '(sin error)'); end if;
  v_err := null;
  begin perform public.celebrar_logro('clientes', 7); exception when others then v_err := sqlerrm; end;
  if v_err is distinct from 'LOGRO_INVALIDO' then raise exception 'FALLÓ 4b: hito 7 salió %', coalesce(v_err, '(sin error)'); end if;

  -- 5. La lista trae lo celebrado y nada de nombres ni teléfonos; la tabla
  --    está cerrada aunque el usuario tenga sesión.
  r := public.logros_lista();
  if jsonb_array_length(r->'celebrados') <> v_celebrados then
    raise exception 'FALLÓ 5a: celebrados esperaba %: %', v_celebrados, r;
  end if;
  if concat(r, public.logros_pendientes()) ~ '\+52|nombre|telefono' then
    raise exception 'FALLÓ 5b: alguna respuesta trae datos de clientes.';
  end if;
  v_err := null;
  begin perform count(*) from public.logros_celebrados; exception when insufficient_privilege then v_err := 'denegado'; end;
  if v_err is null then raise exception 'FALLÓ 5c: authenticated pudo leer logros_celebrados directo.'; end if;
  raise notice '3-5 no alcanzado, inválidos, lista y tabla cerrada OK (% celebrados, próximo %)', v_celebrados, r->'proximo';

  -- 6. Mesero: "Acceso denegado" en las tres.
  if v_mesero is null then
    raise notice '6 mesero OMITIDA: no hay meseros activos';
  else
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_mesero, 'role', 'authenticated')::text, true);
    v_err := null;
    begin perform public.logros_pendientes(); exception when others then v_err := sqlerrm; end;
    if v_err is distinct from 'Acceso denegado' then raise exception 'FALLÓ 6a: mesero en pendientes salió %', coalesce(v_err, '(sin error)'); end if;
    v_err := null;
    begin perform public.celebrar_logro('regresos', 1); exception when others then v_err := sqlerrm; end;
    if v_err is distinct from 'Acceso denegado' then raise exception 'FALLÓ 6b: mesero en celebrar salió %', coalesce(v_err, '(sin error)'); end if;
    v_err := null;
    begin perform public.logros_lista(); exception when others then v_err := sqlerrm; end;
    if v_err is distinct from 'Acceso denegado' then raise exception 'FALLÓ 6c: mesero en lista salió %', coalesce(v_err, '(sin error)'); end if;
    raise notice '6 mesero sin acceso OK';
  end if;

  -- 7. Anon: sin permiso de ejecutar (ni con el sub del dueño).
  set local role anon;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_dueno, 'role', 'anon')::text, true);
  v_err := null;
  begin perform public.logros_pendientes(); exception when insufficient_privilege then v_err := 'denegado'; end;
  if v_err is null then raise exception 'FALLÓ 7a: anon ejecutó logros_pendientes.'; end if;
  v_err := null;
  begin perform public.celebrar_logro('regresos', 1); exception when insufficient_privilege then v_err := 'denegado'; end;
  if v_err is null then raise exception 'FALLÓ 7b: anon ejecutó celebrar_logro.'; end if;
  v_err := null;
  begin perform public.logros_lista(); exception when insufficient_privilege then v_err := 'denegado'; end;
  if v_err is null then raise exception 'FALLÓ 7c: anon ejecutó logros_lista.'; end if;

  raise notice 'OK: fase 8 pasó todas las pruebas';
end;
$$;
rollback;

*/
