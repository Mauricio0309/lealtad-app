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
