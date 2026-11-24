begin;
do $$
declare
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_inactivo uuid := gen_random_uuid();
  v_s text;
  v_s2 text;
  v_s3 text;
  v_esperado jsonb;
  r jsonb;
  v_llaves text[];
  v_ok boolean;
begin
  insert into public.negocios (id, nombre, email, meta_puntos, premio, color_principal, logo_ruta)
  values (v_a, 'Café Ñandú & Hermanos Prueba 6E', 'prueba-6e-a@example.invalid', 7, 'Un café',
          '#0f7b5a', v_a::text || '/logo.png')
  returning slug into v_s;
  if v_s is distinct from 'cafe-nandu-hermanos-prueba-6e' then
    raise exception 'FALLÓ 1: slug %', v_s;
  end if;
  raise notice '1 OK: %', v_s;

  insert into public.negocios (nombre, email) values ('Café Ñandú & Hermanos Prueba 6E', 'prueba-6e-b@example.invalid')
  returning slug into v_s2;
  insert into public.negocios (nombre, email) values ('CAFE ÑANDU  hermanos prueba 6e', 'prueba-6e-c@example.invalid')
  returning slug into v_s3;
  if v_s2 is distinct from 'cafe-nandu-hermanos-prueba-6e-2' or v_s3 is distinct from 'cafe-nandu-hermanos-prueba-6e-3' then
    raise exception 'FALLÓ 2: % y %', v_s2, v_s3;
  end if;
  raise notice '2 OK: % y %', v_s2, v_s3;

  update public.negocios set nombre = 'Otro nombre totalmente distinto' where id = v_a;
  if (select slug from public.negocios where id = v_a) is distinct from 'cafe-nandu-hermanos-prueba-6e' then
    raise exception 'FALLÓ 3: el slug cambió con el nombre.';
  end if;
  raise notice '3 OK: el slug no cambia con el nombre';

  insert into public.negocios (nombre, email, slug) values ('Prueba 6E vacío', 'prueba-6e-d@example.invalid', '')
  returning slug into v_s;
  if v_s is distinct from 'prueba-6e-vacio' then
    raise exception 'FALLÓ 4a: slug vacío dio %', v_s;
  end if;
  insert into public.negocios (id, nombre, email, slug) values (v_b, 'Lo que sea', 'prueba-6e-e@example.invalid', 'prueba-6e-propio')
  returning slug into v_s;
  if v_s is distinct from 'prueba-6e-propio' then
    raise exception 'FALLÓ 4b: slug propio dio %', v_s;
  end if;
  raise notice '4 OK: vacío se genera y propio se respeta';

  v_ok := false;
  begin
    insert into public.negocios (nombre, email, slug) values ('X', 'prueba-6e-f@example.invalid', 'Mal Slug');
  exception when check_violation then v_ok := true;
  end;
  if not v_ok then raise exception 'FALLÓ 5a: aceptó un slug inválido.'; end if;
  v_ok := false;
  begin
    insert into public.negocios (nombre, email, slug) values ('X', 'prueba-6e-g@example.invalid', repeat('a', 41));
  exception when check_violation then v_ok := true;
  end;
  if not v_ok then raise exception 'FALLÓ 5b: aceptó un slug de 41.'; end if;
  v_ok := false;
  begin
    insert into public.negocios (nombre, email, slug) values ('X', 'prueba-6e-h@example.invalid', 'prueba-6e-propio');
  exception when unique_violation then v_ok := true;
  end;
  if not v_ok then raise exception 'FALLÓ 5c: aceptó un slug repetido.'; end if;
  raise notice '5 OK: inválido, largo y repetido rechazados';

  insert into public.negocios (nombre, email)
  values ('Taquería El Gran Sabor del Sureste de la Península de Yucatán 6E', 'prueba-6e-i@example.invalid')
  returning slug into v_s;
  insert into public.negocios (nombre, email)
  values ('Taquería El Gran Sabor del Sureste de la Península de Yucatán 6E', 'prueba-6e-j@example.invalid')
  returning slug into v_s2;
  if length(v_s) > 40 or length(v_s2) > 40 or v_s2 !~ '-2$' or v_s = v_s2
     or v_s !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or v_s2 !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'FALLÓ 6: % / %', v_s, v_s2;
  end if;
  raise notice '6 OK: % / %', v_s, v_s2;

  insert into public.negocios (nombre, email) values ('¡¡!!', 'prueba-6e-k@example.invalid')
  returning slug into v_s;
  if v_s !~ '^negocio(-[0-9]+)?$' then
    raise exception 'FALLÓ 7: %', v_s;
  end if;
  raise notice '7 OK: %', v_s;

  insert into public.negocios (id, nombre, email, premio, activo)
  values (v_inactivo, 'Prueba 6E inactivo', 'prueba-6e-l@example.invalid', 'Un pan', false);

  v_esperado := jsonb_build_object(
    'nombre', 'Otro nombre totalmente distinto',
    'logo', v_a::text || '/logo.png',
    'color', '#0f7b5a',
    'meta', 7,
    'premio', 'Un café'
  );

  set local role anon;
  r := public.public_get_programa('cafe-nandu-hermanos-prueba-6e');
  select array_agg(k order by k) into v_llaves from jsonb_object_keys(r) as k;
  if v_llaves is distinct from array['color', 'logo', 'meta', 'nombre', 'premio'] or r is distinct from v_esperado then
    raise exception 'FALLÓ 8a: %', r;
  end if;
  if public.public_get_programa('  CAFE-NANDU-HERMANOS-PRUEBA-6E ') is distinct from v_esperado then
    raise exception 'FALLÓ 8b: no acepta mayúsculas o espacios.';
  end if;
  reset role;
  update public.negocios set meta_puntos = null where id = v_a;
  set local role anon;
  if (public.public_get_programa('cafe-nandu-hermanos-prueba-6e')->>'meta')::integer is distinct from 10 then
    raise exception 'FALLÓ 8c: meta vacía no dio 10.';
  end if;
  raise notice '8 OK: 5 llaves, valores, mayúsculas/espacios y meta vacía → 10';

  if public.public_get_programa('prueba-6e-inactivo') is not null
     or public.public_get_programa('no-existe-prueba-6e') is not null
     or public.public_get_programa(null) is not null then
    raise exception 'FALLÓ 9a: desactivado, inexistente o null no dieron null.';
  end if;
  reset role;
  set local role authenticated;
  if public.public_get_programa('prueba-6e-propio') is null then
    raise exception 'FALLÓ 9b: authenticated no ve el programa.';
  end if;
  raise notice '9 OK: null cuando debe; authenticated también la usa';

  v_ok := false;
  begin
    update public.negocios set slug = 'hackeo-6e' where id = v_a;
  exception when insufficient_privilege then v_ok := true;
  end;
  if not v_ok then raise exception 'FALLÓ 10a: authenticated pudo escribir el slug.'; end if;
  reset role;
  set local role anon;
  v_ok := false;
  begin
    update public.negocios set slug = 'hackeo-6e' where id = v_a;
  exception when insufficient_privilege then v_ok := true;
  end;
  if not v_ok then raise exception 'FALLÓ 10b: anon pudo escribir el slug.'; end if;
  reset role;
  if (select slug from public.negocios where id = v_a) is distinct from 'cafe-nandu-hermanos-prueba-6e' then
    raise exception 'FALLÓ 10c: el slug cambió.';
  end if;
  raise notice '10 OK: anon y authenticated no escriben el slug';

  raise notice 'OK: fase 6E pasó las 10 pruebas';
end;
$$;
rollback;
