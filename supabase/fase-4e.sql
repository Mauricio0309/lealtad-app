-- Fase 4E: la tarjeta del cliente se siente del negocio (logo y mensaje).
-- NO EJECUTADO. Para revisar. Reemplaza a supabase/fase-4b-tarjeta.sql (que
-- nunca se ejecutó y se borró). Requiere la Fase 4C (profiles.activo).
-- Todo va en UNA transacción: si cualquier paso falla, no se aplica nada.
-- Las pruebas van al final, DESPUÉS del commit, comentadas: se copian y se
-- corren un bloque a la vez. Todas terminan en rollback.
--
-- Qué hace:
--   1. negocios.logo_ruta (ruta del archivo en el bucket "logos") y
--      negocios.mensaje_gracias (máx. 40 caracteres). Ambas opcionales.
--      La columna vieja logo_url (enlaces externos, p. ej. Imgur) se queda en
--      la tabla pero ya no se entrega al cliente.
--   2. Bucket "logos" de lectura pública: PNG, JPG o WebP (nunca SVG), máx. 1 MB.
--      Solo el dueño (activo, de un negocio activo) puede subir, ver la lista
--      o borrar, y solo dentro de la carpeta de su negocio: logos/<negocio_id>/.
--      No hay política de "cambiar": cada logo nuevo es un archivo nuevo.
--   3. guardar_tarjeta(color, logo_ruta, mensaje): solo el dueño; el negocio
--      sale de la sesión. Valida el color contra la paleta, que el logo sea un
--      archivo REAL del bucket en la carpeta de ese negocio, y el mensaje.
--      El color deja de poder cambiarse con un update directo a la tabla.
--   4. public_get_business (la usan ver_codigo, tarjeta_por_token, la página
--      pública y el QR del mostrador) entrega además logo y mensaje. Nada más:
--      deja de entregar logo_url y no toca datos de clientes.
--
-- Errores (en error.message):
--   'Acceso denegado'   sin sesión o no es dueño (o está desactivado)
--   'NEGOCIO_INACTIVO'  el negocio está desactivado
--   'COLOR_INVALIDO'    no es un color de la paleta (ni el que ya tenía)
--   'LOGO_INVALIDO'     la ruta no es un archivo del bucket logos de ESE negocio
--   'MENSAJE_INVALIDO'  más de 40 caracteres

begin;


-- ═══ 0. Comprobaciones previas ═══
do $$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise exception 'No se encontró Supabase Storage (storage.buckets / storage.objects).';
  end if;
  if to_regprocedure('storage.foldername(text)') is null
     or to_regprocedure('storage.extension(text)') is null then
    raise exception 'No se encontraron storage.foldername / storage.extension.';
  end if;
  if to_regprocedure('public.user_has_business_role(uuid, text[])') is null then
    raise exception 'Falta user_has_business_role.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'activo'
  ) then
    raise exception 'Falta profiles.activo (Fase 4C).';
  end if;
  if to_regprocedure('public.public_get_business(uuid)') is null then
    raise exception 'Falta public_get_business.';
  end if;
end;
$$;


-- ═══ 1. Columnas nuevas ═══
alter table public.negocios
  add column if not exists logo_ruta text,
  add column if not exists mensaje_gracias text;

alter table public.negocios
  drop constraint if exists negocios_logo_ruta_formato,
  add constraint negocios_logo_ruta_formato
    check (logo_ruta is null or logo_ruta ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(png|jpg|jpeg|webp)$'),
  drop constraint if exists negocios_mensaje_gracias_largo,
  add constraint negocios_mensaje_gracias_largo
    check (mensaje_gracias is null or length(mensaje_gracias) between 1 and 40);

-- negocios usa permisos por columna: lectura explícita para el panel.
grant select (logo_ruta, mensaje_gracias) on public.negocios to authenticated;

-- El color solo se cambia con guardar_tarjeta (que valida contra la paleta).
revoke update (color_principal) on public.negocios from authenticated;


-- ═══ 2. Bucket de logos ═══
-- Público para leer (el logo se ve en la tarjeta sin sesión). Los límites de
-- tamaño y tipo los aplica Storage al subir; la app además reduce la imagen
-- a 512 px antes de mandarla.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Políticas viejas (de 4b, por si alguien las creó a mano).
drop policy if exists logos_dueno_subir on storage.objects;
drop policy if exists logos_dueno_cambiar on storage.objects;
drop policy if exists logos_dueno_borrar on storage.objects;
drop policy if exists logos_dueno_ver on storage.objects;

-- Regla común: el archivo va en logos/<negocio_id>/<archivo>, sin subcarpetas,
-- y <negocio_id> es el negocio (activo) donde quien llama es dueño activo.
-- La carpeta se compara como texto: un nombre raro no truena la política.
create policy logos_dueno_subir
on storage.objects for insert to authenticated
with check (
  bucket_id = 'logos'
  and array_length(storage.foldername(name), 1) = 1
  and lower(storage.extension(name)) in ('png', 'jpg', 'jpeg', 'webp')
  and exists (
    select 1
    from public.profiles p
    join public.negocios n on n.id = p.negocio_id
    where p.user_id = (select auth.uid())
      and p.role = 'owner' and p.activo and n.activo is true
      and p.negocio_id::text = (storage.foldername(name))[1]
  )
);

-- Ver la lista (solo su carpeta). Storage la necesita para poder borrar.
-- Para MOSTRAR el logo no hace falta: el bucket es público por URL.
create policy logos_dueno_ver
on storage.objects for select to authenticated
using (
  bucket_id = 'logos'
  and exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role = 'owner' and p.activo
      and p.negocio_id::text = (storage.foldername(name))[1]
  )
);

-- Borrar el logo anterior (solo de su carpeta).
create policy logos_dueno_borrar
on storage.objects for delete to authenticated
using (
  bucket_id = 'logos'
  and exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role = 'owner' and p.activo
      and p.negocio_id::text = (storage.foldername(name))[1]
  )
);


-- ═══ 3. guardar_tarjeta(color, logo_ruta, mensaje) ═══
-- Guarda los tres juntos. logo_ruta null = sin logo; mensaje null o vacío =
-- sin mensaje. La paleta es la misma que COLORES_TARJETA en src/pages.js: si
-- cambia una, cambiar la otra. El color que el negocio ya tenía (aunque no
-- esté en la paleta) se acepta para no obligarlo a cambiarlo.
drop function if exists public.guardar_tarjeta(text, text, text);

create function public.guardar_tarjeta(
  p_color text,
  p_logo_ruta text default null,
  p_mensaje text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio public.negocios%rowtype;
  v_color text := lower(btrim(coalesce(p_color, '')));
  v_ruta text := nullif(btrim(coalesce(p_logo_ruta, '')), '');
  v_mensaje text;
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

  if v_color not in ('#1f2937', '#0a5c47', '#0f766e', '#1d4ed8', '#4338ca', '#9f1239', '#9a3412', '#78350f')
     and v_color is distinct from lower(v_negocio.color_principal) then
    raise exception 'COLOR_INVALIDO';
  end if;

  -- El logo: un archivo que EXISTE en el bucket, en la carpeta de este negocio,
  -- con extensión y tipo de imagen permitidos (nunca SVG).
  if v_ruta is not null and (
       v_ruta !~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(png|jpg|jpeg|webp)$'
       or split_part(v_ruta, '/', 1) <> v_negocio.id::text
       or not exists (
         select 1 from storage.objects o
         where o.bucket_id = 'logos'
           and o.name = v_ruta
           and coalesce(o.metadata->>'mimetype', '') in ('image/png', 'image/jpeg', 'image/webp')
       )
     ) then
    raise exception 'LOGO_INVALIDO';
  end if;

  -- Mensaje: sin caracteres de control y con espacios normales.
  v_mensaje := regexp_replace(coalesce(p_mensaje, ''), '[[:cntrl:]]', ' ', 'g');
  v_mensaje := nullif(btrim(regexp_replace(v_mensaje, '\s+', ' ', 'g')), '');
  if v_mensaje is not null and length(v_mensaje) > 40 then
    raise exception 'MENSAJE_INVALIDO';
  end if;

  update public.negocios
  set color_principal = v_color,
      logo_ruta = v_ruta,
      mensaje_gracias = v_mensaje
  where id = v_negocio.id
  returning * into v_negocio;

  return jsonb_build_object(
    'color', v_negocio.color_principal,
    'logo', v_negocio.logo_ruta,
    'mensaje', v_negocio.mensaje_gracias
  );
end;
$$;

revoke all on function public.guardar_tarjeta(text, text, text) from public, anon, authenticated;
grant execute on function public.guardar_tarjeta(text, text, text) to authenticated;


-- ═══ 4. public_get_business con logo y mensaje ═══
-- Mismos campos de antes, con dos cambios: "logo" (ruta en el bucket; la app
-- arma la URL pública) en lugar de logo_url, y "mensaje_gracias".
-- ver_codigo, tarjeta_por_token y public_get_landing la usan tal cual, así
-- que no hay que tocarlas. Solo datos del negocio; nunca de clientes.
create or replace function public.public_get_business(p_business_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', n.id,
    'nombre', n.nombre,
    'logo', n.logo_ruta,
    'mensaje_gracias', n.mensaje_gracias,
    'emoji_negocio', n.emoji_negocio,
    'descripcion', n.descripcion,
    'meta_puntos', n.meta_puntos,
    'color_principal', n.color_principal
  )
  from public.negocios n
  where n.id = p_business_id and n.activo is true;
$$;

revoke all on function public.public_get_business(uuid) from public, anon, authenticated;
grant execute on function public.public_get_business(uuid) to anon, authenticated;


-- ═══ 5. Comprobaciones finales ═══
do $$
declare
  v_llaves text[];
begin
  if not exists (
    select 1 from storage.buckets
    where id = 'logos' and public
      and file_size_limit = 1048576
      and allowed_mime_types @> array['image/png', 'image/jpeg', 'image/webp']
      and not (allowed_mime_types && array['image/svg+xml'])
      and cardinality(allowed_mime_types) = 3
  ) then
    raise exception 'El bucket logos debe ser público, de 1 MB y solo PNG/JPG/WebP.';
  end if;

  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname in ('logos_dueno_subir', 'logos_dueno_ver', 'logos_dueno_borrar')) <> 3 then
    raise exception 'Faltan las políticas del bucket logos.';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
             and policyname like 'logos%' and 'anon' = any (roles)) then
    raise exception 'anon no debe tener políticas en el bucket logos.';
  end if;

  if not exists (
    select 1 from pg_proc
    where oid = to_regprocedure('public.guardar_tarjeta(text, text, text)')
      and prosecdef and 'search_path=""' = any (proconfig)
  ) then
    raise exception 'guardar_tarjeta debe ser security definer con search_path vacío.';
  end if;
  if has_function_privilege('anon', 'public.guardar_tarjeta(text, text, text)', 'execute') then
    raise exception 'anon NO debe poder ejecutar guardar_tarjeta.';
  end if;
  if not has_function_privilege('authenticated', 'public.guardar_tarjeta(text, text, text)', 'execute') then
    raise exception 'authenticated debe poder ejecutar guardar_tarjeta.';
  end if;

  if has_column_privilege('authenticated', 'public.negocios', 'color_principal', 'update')
     or has_column_privilege('authenticated', 'public.negocios', 'logo_ruta', 'update')
     or has_column_privilege('authenticated', 'public.negocios', 'mensaje_gracias', 'update') then
    raise exception 'Color, logo y mensaje solo se cambian con guardar_tarjeta.';
  end if;
  if not has_column_privilege('authenticated', 'public.negocios', 'mensaje_gracias', 'select')
     or not has_column_privilege('authenticated', 'public.negocios', 'logo_ruta', 'select') then
    raise exception 'authenticated debe poder leer logo_ruta y mensaje_gracias.';
  end if;

  -- public_get_business: exactamente estas llaves (nada de clientes ni logo_url).
  select array_agg(k order by k) into v_llaves
  from jsonb_object_keys(
    coalesce(
      public.public_get_business((select id from public.negocios where activo is true limit 1)),
      jsonb_build_object('id', 1, 'nombre', 1, 'logo', 1, 'mensaje_gracias', 1, 'emoji_negocio', 1,
                         'descripcion', 1, 'meta_puntos', 1, 'color_principal', 1)
    )
  ) as k;
  if v_llaves <> array['color_principal', 'descripcion', 'emoji_negocio', 'id', 'logo',
                       'mensaje_gracias', 'meta_puntos', 'nombre'] then
    raise exception 'public_get_business entrega llaves inesperadas: %', v_llaves;
  end if;
  if not has_function_privilege('anon', 'public.public_get_business(uuid)', 'execute') then
    raise exception 'anon debe poder ejecutar public_get_business (tarjeta sin sesión).';
  end if;
end;
$$;


commit;


-- ═══════════════════════════════════════════════════════════════════════
-- PRUEBAS (después de aplicar; un bloque a la vez; terminan en rollback)
-- ═══════════════════════════════════════════════════════════════════════
-- Para actuar como dueño o mesero:
--   set local role authenticated;
--   select set_config('request.jwt.claims', ...)   ← auth.uid() lee el "sub"
/*

-- ═══ PRUEBA 1: guardar color y mensaje (sin logo) ═══
-- Esperado: {"color": "#1d4ed8", "logo": null, "mensaje": "¡Gracias por volver!"}
begin;
select set_config('prueba.dueno', p.user_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where p.role = 'owner' and p.activo and n.activo is true order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select public.guardar_tarjeta('#1D4ED8', null, E'  ¡Gracias \t  por volver!  ');
rollback;


-- ═══ PRUEBA 2: logo real de su carpeta y lo que ve el cliente ═══
-- Simula un archivo ya subido (fila en storage.objects) y lo guarda.
-- Esperado: guardado → "logo": "<negocio>/logo-prueba.webp";
--   publico (como anon) → trae "logo" y "mensaje_gracias", sin "logo_url"
--   ni teléfonos; tiene_datos_clientes false.
begin;
select set_config('prueba.dueno', p.user_id::text, true),
       set_config('prueba.negocio', p.negocio_id::text, true),
       set_config('prueba.color', lower(n.color_principal), true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where p.role = 'owner' and p.activo and n.activo is true order by p.created_at limit 1;
insert into storage.objects (bucket_id, name, metadata)
values ('logos', current_setting('prueba.negocio') || '/logo-prueba.webp', '{"mimetype": "image/webp", "size": 2048}');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select public.guardar_tarjeta(current_setting('prueba.color'), current_setting('prueba.negocio') || '/logo-prueba.webp', 'Gracias por venir') as guardado;
reset role;
set local role anon;
select public.public_get_business(current_setting('prueba.negocio')::uuid) as publico,
       public.public_get_business(current_setting('prueba.negocio')::uuid)::text ~ '\+52|telefono|logo_url' as tiene_datos_clientes;
rollback;


-- ═══ PRUEBA 3: logo de otro negocio ═══
-- Esperado: ERROR: LOGO_INVALIDO
begin;
select set_config('prueba.dueno', p.user_id::text, true),
       set_config('prueba.color', lower(n.color_principal), true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where p.role = 'owner' and p.activo and n.activo is true order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select public.guardar_tarjeta(current_setting('prueba.color'), '00000000-0000-0000-0000-000000000000/logo.png');
rollback;


-- ═══ PRUEBA 4: ruta de su carpeta pero el archivo no existe ═══
-- Esperado: ERROR: LOGO_INVALIDO
begin;
select set_config('prueba.dueno', p.user_id::text, true),
       set_config('prueba.negocio', p.negocio_id::text, true),
       set_config('prueba.color', lower(n.color_principal), true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where p.role = 'owner' and p.activo and n.activo is true order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select public.guardar_tarjeta(current_setting('prueba.color'), current_setting('prueba.negocio') || '/no-existe.png');
rollback;


-- ═══ PRUEBA 5: color fuera de la paleta y mensaje largo ═══
-- Esperado: ERROR: COLOR_INVALIDO. Luego, cambiando el color por uno de la
-- paleta y el mensaje por uno de 41 letras: ERROR: MENSAJE_INVALIDO.
begin;
select set_config('prueba.dueno', p.user_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where p.role = 'owner' and p.activo and n.activo is true order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select public.guardar_tarjeta('#ff00ff');
-- select public.guardar_tarjeta('#1f2937', null, repeat('a', 41));
rollback;


-- ═══ PRUEBA 6: Storage solo deja subir a la carpeta propia y nunca SVG ═══
-- Corre las tres líneas de insert una por una (cada error aborta el bloque).
-- Esperado: la de su carpeta (.webp) funciona; la de otro negocio y la .svg
-- fallan con "new row violates row-level security policy".
begin;
select set_config('prueba.dueno', p.user_id::text, true),
       set_config('prueba.negocio', p.negocio_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where p.role = 'owner' and p.activo and n.activo is true order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
insert into storage.objects (bucket_id, name) values ('logos', current_setting('prueba.negocio') || '/logo-prueba.webp');
-- insert into storage.objects (bucket_id, name) values ('logos', '00000000-0000-0000-0000-000000000000/logo.webp');
-- insert into storage.objects (bucket_id, name) values ('logos', current_setting('prueba.negocio') || '/logo.svg');
rollback;


-- ═══ PRUEBA 7: un mesero no guarda la tarjeta ═══
-- (Necesita un perfil con rol "mesero".)
-- Esperado: ERROR: Acceso denegado
begin;
select set_config('prueba.mesero', p.user_id::text, true)
from public.profiles p where p.role = 'mesero' order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.mesero'), 'role', 'authenticated')::text, true);
select public.guardar_tarjeta('#1f2937');
rollback;


-- ═══ PRUEBA 8: sin sesión no se guarda nada ═══
-- Esperado: ERROR: permission denied for function guardar_tarjeta
begin;
set local role anon;
select public.guardar_tarjeta('#1f2937');
rollback;


-- ═══ PRUEBA 9: el color ya no se cambia directo en la tabla ═══
-- Esperado: ERROR: permission denied for table negocios
begin;
select set_config('prueba.dueno', p.user_id::text, true),
       set_config('prueba.negocio', p.negocio_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where p.role = 'owner' and p.activo and n.activo is true order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
update public.negocios set color_principal = '#ff00ff' where id = current_setting('prueba.negocio')::uuid;
rollback;

*/
