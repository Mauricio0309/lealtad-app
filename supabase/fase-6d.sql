-- ═══════════════════════════════════════════════════════════════════════
-- Fase 6D: public_get_landing ya no publica conteos ni niveles
-- ═══════════════════════════════════════════════════════════════════════
-- NO APLICADO. Para revisar antes de correrlo.
-- Requiere: phase-3-rls.sql (la función), 2A (negocios.premio) y 4E
-- (negocios.logo_ruta). Todo va en UNA transacción: si algo falla, no se
-- aplica nada.
--
-- ── Por qué ──
-- #/landing/<id> es pública (anon, sin sesión). Hoy public_get_landing
-- devuelve:
--   business        public_get_business(): id, nombre, logo, mensaje_gracias,
--                   emoji_negocio, descripcion, meta_puntos, color_principal
--   levels          niveles de la app vieja (nombre, emoji, visitas_minimas,
--                   premio_bienvenida); el MVP ya no usa niveles
--   customer_count  clientes registrados del negocio
--   visit_count     visitas no anuladas del negocio
-- Cualquiera con el link (o que pruebe ids) ve cuántos clientes y visitas
-- tiene el negocio. Eso es información del dueño, no del cliente.
--
-- ── Qué devuelve ahora ──
-- Solo lo que la página necesita para invitar a unirse:
--   { "nombre": text, "logo": text|null, "color": text, "meta": int, "premio": text }
--   nombre   negocios.nombre
--   logo     negocios.logo_ruta (ruta en el bucket; la app arma la URL con urlLogo)
--   color    negocios.color_principal
--   meta     negocios.meta_puntos (10 si está vacío, igual que tarjeta_por_token)
--   premio   negocios.premio
-- Negocio inexistente o desactivado: null (igual que hoy).
-- Ya no llama a public_get_business (que trae más campos); lee negocios
-- directo con el mismo filtro "activo is true". public_get_business NO se toca.
--
-- ── Permisos: iguales que hoy ──
-- execute para anon y authenticated (la página es sin sesión); PUBLIC sin
-- execute directo; service_role y postgres los conserva (create or replace no
-- cambia el dueño ni los permisos que ya tenía).
--
-- ── OJO: la app actual se rompe con esta versión ──
-- paginaLanding (src/pages.js) lee resumen.business, resumen.levels,
-- resumen.customer_count y resumen.visit_count. Con la forma nueva,
-- resumen.business no existe y la página muestra "No encontrado".
-- Aplicar este archivo JUNTO con el cambio de paginaLanding (leer el objeto
-- plano, quitar la sección de niveles y las dos tarjetas de conteos), no antes.

begin;


-- ═══ 0. Comprobaciones previas ═══
do $$
declare
  v_oid oid := to_regprocedure('public.public_get_landing(uuid)');
begin
  if v_oid is null then
    raise exception 'Falta public_get_landing(uuid) (phase-3-rls.sql).';
  end if;

  -- create or replace solo funciona si el tipo de regreso no cambia.
  if (select p.prorettype from pg_proc p where p.oid = v_oid) <> 'jsonb'::regtype then
    raise exception 'public_get_landing debe devolver jsonb; si no, create or replace falla.';
  end if;

  -- Columnas que usa la versión nueva.
  if (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'negocios'
        and column_name in ('nombre', 'logo_ruta', 'color_principal', 'meta_puntos', 'premio', 'activo')) <> 6 then
    raise exception 'A negocios le falta alguna columna: nombre, logo_ruta (4E), color_principal, meta_puntos, premio (2A) o activo.';
  end if;

  -- Los permisos de hoy (los que se van a conservar).
  if not has_function_privilege('anon', v_oid, 'execute')
     or not has_function_privilege('authenticated', v_oid, 'execute') then
    raise exception 'Hoy anon y authenticated deberían poder ejecutar public_get_landing; revisar antes de seguir.';
  end if;
end;
$$;


-- ═══ 1. public_get_landing: solo nombre, logo, color, meta y premio ═══
create or replace function public.public_get_landing(p_business_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'nombre', n.nombre,
    'logo',   n.logo_ruta,
    'color',  n.color_principal,
    'meta',   coalesce(n.meta_puntos, 10),
    'premio', n.premio
  )
  from public.negocios n
  where n.id = p_business_id and n.activo is true;
$$;

revoke all on function public.public_get_landing(uuid) from public, anon, authenticated;
grant execute on function public.public_get_landing(uuid) to anon, authenticated;


-- ═══ 2. Verificación final (si algo falla, se deshace todo) ═══
do $$
declare
  v_oid oid := to_regprocedure('public.public_get_landing(uuid)');
  v_src text;
  v_negocio uuid;
  v_llaves text[];
begin
  select p.prosrc into v_src from pg_proc p where p.oid = v_oid;

  if not exists (
    select 1 from pg_proc p
    where p.oid = v_oid and p.prosecdef and p.provolatile = 's'
      and 'search_path=""' = any (p.proconfig)
  ) then
    raise exception 'public_get_landing debe ser stable, security definer y con search_path vacío.';
  end if;

  -- Ya no lee clientes, visitas ni niveles, ni cuenta nada.
  if v_src ~* '(clientes|visitas|niveles|count\s*\()' then
    raise exception 'public_get_landing todavía lee clientes, visitas o niveles.';
  end if;

  -- Permisos iguales que hoy.
  if not has_function_privilege('anon', v_oid, 'execute')
     or not has_function_privilege('authenticated', v_oid, 'execute') then
    raise exception 'anon y authenticated deben poder ejecutar public_get_landing (página sin sesión).';
  end if;
  if exists (
    select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = v_oid and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) then
    raise exception 'PUBLIC no debe tener execute directo sobre public_get_landing.';
  end if;

  -- Con un negocio real: exactamente las 5 llaves.
  select n.id into v_negocio from public.negocios n where n.activo is true limit 1;
  if v_negocio is not null then
    select array_agg(k order by k) into v_llaves
    from jsonb_object_keys(public.public_get_landing(v_negocio)) as k;
    if v_llaves is distinct from array['color', 'logo', 'meta', 'nombre', 'premio'] then
      raise exception 'public_get_landing entrega llaves inesperadas: %', v_llaves;
    end if;
  end if;

  if public.public_get_landing(gen_random_uuid()) is not null then
    raise exception 'Un negocio inexistente debe dar null.';
  end if;
end;
$$;


commit;


-- ═══════════════════════════════════════════════════════════════════════
-- PRUEBAS (después de aplicar; terminan en rollback, no dejan rastro)
-- ═══════════════════════════════════════════════════════════════════════
-- Las mismas que supabase/fase-6d-pruebas.sql. Crean dos negocios de prueba
-- (uno activo con logo, otro desactivado) y llaman la función como anon y
-- como authenticated. Comprueban:
--   1. exactamente las 5 llaves;  2. los valores correctos;
--   3. sin customer_count, visit_count, levels ni business;
--   4. negocio desactivado → null;  5. inexistente → null;  6. id null → null;
--   7. authenticated ve lo mismo que anon;  8. meta vacía → 10;
--   9. todos los negocios activos dan solo las 5 llaves;
--  10. permisos: anon y authenticated sí, PUBLIC no; security definer y
--      search_path vacío.
-- Esperado: NOTICE "OK: fase 6D pasó las 10 pruebas".
/*

begin;
do $$
declare
  v_activo uuid := gen_random_uuid();
  v_inactivo uuid := gen_random_uuid();
  v_oid oid := to_regprocedure('public.public_get_landing(uuid)');
  v_esperado jsonb;
  r jsonb;
  v_llaves text[];
  v_n integer;
begin
  insert into public.negocios (id, nombre, email, meta_puntos, premio, color_principal, logo_ruta)
  values (v_activo, 'Prueba Fase 6D', 'prueba-fase-6d@example.invalid', 7, 'Un café americano',
          '#0f7b5a', v_activo::text || '/logo.png');
  insert into public.negocios (id, nombre, email, meta_puntos, premio, activo)
  values (v_inactivo, 'Prueba Fase 6D inactivo', 'prueba-fase-6d-b@example.invalid', 5, 'Un pan', false);

  v_esperado := jsonb_build_object(
    'nombre', 'Prueba Fase 6D',
    'logo', v_activo::text || '/logo.png',
    'color', '#0f7b5a',
    'meta', 7,
    'premio', 'Un café americano'
  );

  set local role anon;

  r := public.public_get_landing(v_activo);
  select array_agg(k order by k) into v_llaves from jsonb_object_keys(r) as k;
  if v_llaves is distinct from array['color', 'logo', 'meta', 'nombre', 'premio'] then
    raise exception 'FALLÓ 1: llaves inesperadas: %', v_llaves;
  end if;
  raise notice '1 OK: solo nombre, logo, color, meta y premio';

  if r is distinct from v_esperado then
    raise exception 'FALLÓ 2: esperaba %, salió %', v_esperado, r;
  end if;
  raise notice '2 OK: valores correctos';

  if r ?| array['customer_count', 'visit_count', 'levels', 'business'] then
    raise exception 'FALLÓ 3: todavía trae conteos o niveles: %', r;
  end if;
  raise notice '3 OK: sin customer_count, visit_count, levels ni business';

  if public.public_get_landing(v_inactivo) is not null then
    raise exception 'FALLÓ 4: un negocio desactivado debe dar null.';
  end if;
  raise notice '4 OK: negocio desactivado da null';

  if public.public_get_landing(gen_random_uuid()) is not null then
    raise exception 'FALLÓ 5: un negocio inexistente debe dar null.';
  end if;
  raise notice '5 OK: negocio inexistente da null';

  if public.public_get_landing(null) is not null then
    raise exception 'FALLÓ 6: id null debe dar null.';
  end if;
  raise notice '6 OK: id null da null';

  reset role;
  set local role authenticated;
  r := public.public_get_landing(v_activo);
  if r is distinct from v_esperado then
    raise exception 'FALLÓ 7: authenticated ve algo distinto: %', r;
  end if;
  raise notice '7 OK: authenticated ve lo mismo que anon';

  reset role;
  update public.negocios set meta_puntos = null where id = v_activo;
  set local role anon;
  r := public.public_get_landing(v_activo);
  if (r->>'meta')::integer is distinct from 10 then
    raise exception 'FALLÓ 8: meta vacía debe dar 10, salió %', r->'meta';
  end if;
  raise notice '8 OK: meta vacía da 10';

  reset role;
  select count(*) into v_n
  from public.negocios n
  where n.activo is true
    and (select array_agg(k order by k) from jsonb_object_keys(public.public_get_landing(n.id)) as k)
        is distinct from array['color', 'logo', 'meta', 'nombre', 'premio'];
  if v_n > 0 then
    raise exception 'FALLÓ 9: % negocios activos dan llaves distintas a las 5.', v_n;
  end if;
  raise notice '9 OK: todos los negocios activos dan solo las 5 llaves';

  if not has_function_privilege('anon', v_oid, 'execute')
     or not has_function_privilege('authenticated', v_oid, 'execute') then
    raise exception 'FALLÓ 10a: anon y authenticated deben poder ejecutarla.';
  end if;
  if exists (
    select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = v_oid and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) then
    raise exception 'FALLÓ 10b: PUBLIC no debe tener execute directo.';
  end if;
  if not exists (
    select 1 from pg_proc p
    where p.oid = v_oid and p.prosecdef and 'search_path=""' = any (p.proconfig)
  ) then
    raise exception 'FALLÓ 10c: debe ser security definer con search_path vacío.';
  end if;
  raise notice '10 OK: permisos iguales que antes, security definer y search_path vacío';

  raise notice 'OK: fase 6D pasó las 10 pruebas';
end;
$$;
rollback;

*/
