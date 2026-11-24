-- ═══════════════════════════════════════════════════════════════════════
-- Fase 6E: slug del negocio para la página pública /#/n/<slug>
-- ═══════════════════════════════════════════════════════════════════════
-- NO APLICADO. Para revisar antes de correrlo.
-- Requiere: 2A (negocios.premio), 4E (negocios.logo_ruta). Todo va en UNA
-- transacción: si algo falla, no se aplica nada.
--
-- Qué agrega:
--   1. negocios.slug  text, NOT NULL, único, formato ^[a-z0-9]+(-[a-z0-9]+)*$,
--      máx. 40. Se rellena para los negocios que ya existen.
--   2. slug_desde_nombre(texto)  minúsculas, sin acentos, guiones; si no
--      queda nada, 'negocio'. Interna.
--   3. slug_unico(nombre, excluir)  el de arriba y, si ya existe, -2, -3...
--      (recortando la base para no pasar de 40). Interna.
--   4. Trigger BEFORE INSERT negocios_slug_al_crear: si el slug viene vacío lo
--      genera. alta_negocio y la Edge Function crear-negocio NO se tocan.
--      No hay trigger de UPDATE: si después cambia el nombre, el slug se queda
--      (así no se rompen los links ya compartidos).
--   5. public_get_programa(p_slug)  pública (anon y authenticated), solo
--      lectura: { nombre, logo, color, meta, premio }; null si no existe o el
--      negocio está desactivado. Nunca datos de clientes ni del equipo.
--      Acepta mayúsculas y espacios alrededor (se normaliza).
--
-- Permisos:
--   - slug: anon y authenticated NO pueden escribirlo (ni insert ni update).
--     authenticated SÍ puede leerlo (el panel del dueño mostrará su link; es
--     público de todas formas). anon no lee negocios directo (como hoy).
--   - slug_desde_nombre, slug_unico y la función del trigger: sin execute para
--     PUBLIC, anon ni authenticated (el trigger corre sin ese permiso).
--
-- Concurrencia: generar el slug toma un candado de la transacción
-- (pg_advisory_xact_lock) para que dos altas con el mismo nombre a la vez no
-- choquen con el índice único.
--
-- Rellenado de los existentes: en orden de alta (fecha_creacion, id); el más
-- antiguo se queda con el slug "limpio" y los repetidos llevan -2, -3...
-- Para revisar el resultado ANTES de aplicar (no cambia nada):
--   select nombre, fecha_creacion from public.negocios order by fecha_creacion, id;

begin;


-- ═══ 0. Comprobaciones previas ═══
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'negocios' and column_name = 'slug'
  ) then
    raise exception 'negocios.slug ya existe: esta fase ya se aplicó (o hay una columna con ese nombre).';
  end if;

  if (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'negocios'
        and column_name in ('id', 'nombre', 'activo', 'logo_ruta', 'color_principal', 'meta_puntos', 'premio', 'fecha_creacion')) <> 8 then
    raise exception 'A negocios le falta alguna columna: id, nombre, activo, logo_ruta (4E), color_principal, meta_puntos, premio (2A) o fecha_creacion.';
  end if;

  if to_regprocedure('public.public_get_programa(text)') is not null
     or to_regprocedure('public.slug_desde_nombre(text)') is not null
     or to_regprocedure('public.slug_unico(text, uuid)') is not null
     or to_regprocedure('public.negocios_slug_al_crear()') is not null then
    raise exception 'Ya existe alguna función de esta fase (public_get_programa, slug_desde_nombre, slug_unico o negocios_slug_al_crear).';
  end if;

  if exists (select 1 from pg_trigger where tgrelid = 'public.negocios'::regclass and tgname = 'negocios_slug_al_crear') then
    raise exception 'Ya existe el trigger negocios_slug_al_crear.';
  end if;
end;
$$;


-- ═══ 1. Funciones para generar el slug ═══
-- Minúsculas, sin acentos (sin la extensión unaccent: translate), todo lo que
-- no sea letra o número se vuelve un guion, sin guiones repetidos ni en las
-- orillas, máx. 40. Si no queda nada (p. ej. "¡¡!!"), 'negocio'.
create function public.slug_desde_nombre(p_texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      btrim(left(
        btrim(regexp_replace(
          translate(lower(coalesce(p_texto, '')),
                    'áàäâãåéèëêíìïîóòöôõúùüûñçý',
                    'aaaaaaeeeeiiiiooooouuuuncy'),
          '[^a-z0-9]+', '-', 'g'), '-'),
        40), '-'),
      ''),
    'negocio');
$$;

-- El slug del nombre; si ya lo usa otro negocio, -2, -3... La base se recorta
-- para que con el sufijo no pase de 40. Security definer: ve TODOS los
-- negocios aunque quien inserte tenga RLS.
create function public.slug_unico(p_nombre text, p_excluir uuid default null)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base text := public.slug_desde_nombre(p_nombre);
  v_slug text := v_base;
  v_n integer := 1;
  v_sufijo text;
begin
  while exists (
    select 1 from public.negocios n
    where n.slug = v_slug and n.id is distinct from p_excluir
  ) loop
    v_n := v_n + 1;
    v_sufijo := '-' || v_n;
    v_slug := btrim(left(v_base, 40 - length(v_sufijo)), '-') || v_sufijo;
  end loop;
  return v_slug;
end;
$$;

revoke all on function public.slug_desde_nombre(text) from public, anon, authenticated;
revoke all on function public.slug_unico(text, uuid) from public, anon, authenticated;


-- ═══ 2. Columna y relleno de los negocios existentes ═══
alter table public.negocios add column slug text;

comment on column public.negocios.slug is
  'Identificador público de la página /#/n/<slug>. Se genera al crear el negocio y NO cambia con el nombre.';

do $$
declare
  r record;
begin
  perform pg_advisory_xact_lock(hashtext('public.negocios.slug'));
  for r in
    select n.id, n.nombre from public.negocios n
    where n.slug is null
    order by n.fecha_creacion nulls last, n.id
  loop
    update public.negocios set slug = public.slug_unico(r.nombre, r.id) where id = r.id;
  end loop;
end;
$$;

alter table public.negocios
  alter column slug set not null,
  add constraint negocios_slug_formato
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 40),
  add constraint negocios_slug_unico unique (slug);


-- ═══ 3. Trigger: genera el slug al crear si viene vacío ═══
create function public.negocios_slug_al_crear()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    perform pg_advisory_xact_lock(hashtext('public.negocios.slug'));
    new.slug := public.slug_unico(new.nombre, new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.negocios_slug_al_crear() from public, anon, authenticated;

create trigger negocios_slug_al_crear
  before insert on public.negocios
  for each row execute function public.negocios_slug_al_crear();


-- ═══ 4. Permisos de la columna ═══
-- negocios usa permisos por columna. Nadie escribe el slug directo.
revoke insert (slug), update (slug) on public.negocios from anon, authenticated;
grant select (slug) on public.negocios to authenticated;


-- ═══ 5. public_get_programa(p_slug): la página pública ═══
create function public.public_get_programa(p_slug text)
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
  where n.slug = lower(btrim(p_slug)) and n.activo is true;
$$;

revoke all on function public.public_get_programa(text) from public, anon, authenticated;
grant execute on function public.public_get_programa(text) to anon, authenticated;


-- ═══ 6. Verificación final (si algo falla, se deshace todo) ═══
do $$
declare
  v_oid oid := to_regprocedure('public.public_get_programa(text)');
  v_funcion text;
  v_negocio uuid;
  v_slug text;
  v_llaves text[];
begin
  -- Todos los negocios con slug válido y sin repetir.
  if exists (
    select 1 from public.negocios
    where slug is null or slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(slug) > 40
  ) then
    raise exception 'Hay negocios sin slug o con un slug inválido.';
  end if;
  if exists (select 1 from public.negocios group by slug having count(*) > 1) then
    raise exception 'Hay slugs repetidos.';
  end if;
  if (select count(*) from pg_constraint
      where conrelid = 'public.negocios'::regclass
        and conname in ('negocios_slug_formato', 'negocios_slug_unico')) <> 2 then
    raise exception 'Faltan las restricciones del slug.';
  end if;

  -- Trigger solo de INSERT, activo.
  if not exists (
    select 1 from pg_trigger t
    where t.tgrelid = 'public.negocios'::regclass and t.tgname = 'negocios_slug_al_crear'
      and t.tgenabled <> 'D'
      and (t.tgtype & 4) <> 0     -- INSERT
      and (t.tgtype & 16) = 0     -- no UPDATE
      and (t.tgtype & 2) <> 0     -- BEFORE
  ) then
    raise exception 'El trigger negocios_slug_al_crear debe ser BEFORE INSERT (sin UPDATE) y estar activo.';
  end if;

  -- Funciones: security definer (las que leen negocios) y search_path vacío.
  foreach v_funcion in array array[
    'public.public_get_programa(text)',
    'public.slug_unico(text, uuid)',
    'public.negocios_slug_al_crear()'
  ] loop
    if not exists (
      select 1 from pg_proc p
      where p.oid = to_regprocedure(v_funcion) and p.prosecdef and 'search_path=""' = any (p.proconfig)
    ) then
      raise exception '% debe ser security definer con search_path vacío.', v_funcion;
    end if;
  end loop;
  if not exists (
    select 1 from pg_proc p
    where p.oid = to_regprocedure('public.slug_desde_nombre(text)') and 'search_path=""' = any (p.proconfig)
  ) then
    raise exception 'slug_desde_nombre debe tener search_path vacío.';
  end if;
  if (select p.provolatile from pg_proc p where p.oid = v_oid) <> 's' then
    raise exception 'public_get_programa debe ser stable (solo lectura).';
  end if;

  -- public_get_programa: pública; nunca toca clientes ni equipo.
  if not has_function_privilege('anon', v_oid, 'execute')
     or not has_function_privilege('authenticated', v_oid, 'execute') then
    raise exception 'anon y authenticated deben poder ejecutar public_get_programa.';
  end if;
  if exists (
    select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = v_oid and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) then
    raise exception 'PUBLIC no debe tener execute directo sobre public_get_programa.';
  end if;
  if (select p.prosrc from pg_proc p where p.oid = v_oid)
     ~* '(clientes|visitas|profiles|canjes|codigos|numeros_excluidos|telefono|email)' then
    raise exception 'public_get_programa no debe leer datos de clientes ni del equipo.';
  end if;

  -- Las internas, cerradas.
  foreach v_funcion in array array[
    'public.slug_desde_nombre(text)',
    'public.slug_unico(text, uuid)',
    'public.negocios_slug_al_crear()'
  ] loop
    if has_function_privilege('anon', v_funcion, 'execute')
       or has_function_privilege('authenticated', v_funcion, 'execute') then
      raise exception '% debe ser interna (sin execute para anon/authenticated).', v_funcion;
    end if;
  end loop;

  -- Nadie escribe el slug directo.
  if has_column_privilege('anon', 'public.negocios', 'slug', 'insert')
     or has_column_privilege('anon', 'public.negocios', 'slug', 'update')
     or has_column_privilege('authenticated', 'public.negocios', 'slug', 'insert')
     or has_column_privilege('authenticated', 'public.negocios', 'slug', 'update') then
    raise exception 'anon/authenticated NO deben poder escribir negocios.slug.';
  end if;

  -- Con un negocio real activo: exactamente las 5 llaves.
  select n.id, n.slug into v_negocio, v_slug from public.negocios n where n.activo is true limit 1;
  if v_negocio is not null then
    select array_agg(k order by k) into v_llaves
    from jsonb_object_keys(public.public_get_programa(v_slug)) as k;
    if v_llaves is distinct from array['color', 'logo', 'meta', 'nombre', 'premio'] then
      raise exception 'public_get_programa entrega llaves inesperadas: %', v_llaves;
    end if;
  end if;
  if public.public_get_programa('no-existe-' || md5(random()::text)) is not null then
    raise exception 'Un slug inexistente debe dar null.';
  end if;
end;
$$;


commit;


-- ═══════════════════════════════════════════════════════════════════════
-- PRUEBAS (después de aplicar; terminan en rollback, no dejan rastro)
-- ═══════════════════════════════════════════════════════════════════════
-- Las mismas que supabase/fase-6e-pruebas.sql. Crean negocios de prueba y
-- comprueban:
--   1. nombre con acentos, ñ y "&" → slug limpio;
--   2. mismo nombre → -2 y -3;
--   3. cambiar el nombre NO cambia el slug;
--   4. slug vacío ('') → se genera; slug propio válido → se respeta;
--   5. slug inválido, de más de 40 o repetido → rechazados;
--   6. nombre muy largo → máx. 40, también con sufijo;
--   7. nombre sin letras ("¡¡!!") → 'negocio' (o negocio-N);
--   8. public_get_programa como anon: 5 llaves y valores; acepta mayúsculas y
--      espacios; meta vacía → 10;
--   9. desactivado, inexistente y null → null; authenticated ve lo mismo;
--  10. anon y authenticated no pueden escribir el slug directo.
-- Esperado: NOTICE "OK: fase 6E pasó las 10 pruebas".
/*

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

*/
