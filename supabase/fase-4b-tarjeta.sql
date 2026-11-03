-- Fase 4b: logo y mensaje de agradecimiento de la tarjeta del cliente.
-- NO EJECUTADO. Para revisar. La app todavía no lo usa: hoy "Tarjeta de tus
-- clientes" solo guarda el color. Después de correrlo falta:
--   - en Ajustes: subir el logo y escribir el mensaje (llamando guardar_tarjeta);
--   - en la tarjeta del cliente: mostrar logo y mensaje (lo devuelve
--     public_get_business / tarjeta_por_token, que hay que ampliar).
--
-- Todo va en UNA transacción: si cualquier paso falla, no se aplica nada.
--
-- Qué hace:
--   1. negocios.mensaje_gracias (máx. 40 caracteres, opcional).
--   2. Bucket público "logos" (PNG, JPG o WebP, máx. 512 KB). Cada dueño solo
--      puede subir, cambiar o borrar archivos dentro de la carpeta de su negocio
--      (logos/<negocio_id>/...). Leerlos es público: el logo se ve en la tarjeta.
--   3. guardar_tarjeta(color, logo_url, mensaje): valida cada valor contra lo
--      permitido (CLAUDE.md: "nunca campos libres") y guarda los tres juntos.
--      El color debe ser uno de la paleta de Ajustes.
--
-- Errores que verá la app:
--   'Acceso denegado' / 'NEGOCIO_INACTIVO'
--   'COLOR_INVALIDO'    no es un color de la paleta
--   'LOGO_INVALIDO'     la URL no es un archivo del bucket logos de ESE negocio
--   'MENSAJE_INVALIDO'  más de 40 caracteres

begin;


-- ═══ 0. Comprobaciones previas ═══
do $$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise exception 'No se encontró Supabase Storage (storage.buckets / storage.objects).';
  end if;
  if to_regprocedure('storage.foldername(text)') is null then
    raise exception 'No se encontró storage.foldername.';
  end if;
  if to_regprocedure('public.user_has_business_role(uuid, text[])') is null then
    raise exception 'Falta user_has_business_role.';
  end if;
end;
$$;


-- ═══ 1. Mensaje de agradecimiento ═══
alter table public.negocios
  add column if not exists mensaje_gracias text;

alter table public.negocios
  drop constraint if exists negocios_mensaje_gracias_largo,
  add constraint negocios_mensaje_gracias_largo
    check (mensaje_gracias is null or length(mensaje_gracias) between 1 and 40);

grant select (mensaje_gracias) on public.negocios to authenticated;


-- ═══ 2. Bucket de logos ═══
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 524288, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- El dueño escribe solo en la carpeta de su negocio: logos/<negocio_id>/archivo.
-- La carpeta se compara como texto con los negocios donde es dueño (sin
-- convertir a uuid, para que un nombre raro no truene la política).
drop policy if exists logos_dueno_subir on storage.objects;
drop policy if exists logos_dueno_cambiar on storage.objects;
drop policy if exists logos_dueno_borrar on storage.objects;

create policy logos_dueno_subir
on storage.objects for insert to authenticated
with check (
  bucket_id = 'logos'
  and (storage.foldername(name))[1] in (
    select p.negocio_id::text from public.profiles p
    where p.user_id = auth.uid() and p.role = 'owner'
  )
);

create policy logos_dueno_cambiar
on storage.objects for update to authenticated
using (
  bucket_id = 'logos'
  and (storage.foldername(name))[1] in (
    select p.negocio_id::text from public.profiles p
    where p.user_id = auth.uid() and p.role = 'owner'
  )
)
with check (
  bucket_id = 'logos'
  and (storage.foldername(name))[1] in (
    select p.negocio_id::text from public.profiles p
    where p.user_id = auth.uid() and p.role = 'owner'
  )
);

create policy logos_dueno_borrar
on storage.objects for delete to authenticated
using (
  bucket_id = 'logos'
  and (storage.foldername(name))[1] in (
    select p.negocio_id::text from public.profiles p
    where p.user_id = auth.uid() and p.role = 'owner'
  )
);


-- ═══ 3. guardar_tarjeta(color, logo_url, mensaje) ═══
-- La misma paleta que COLORES_TARJETA en src/pages.js. Si cambia una, cambiar
-- la otra.
create or replace function public.guardar_tarjeta(
  p_color text,
  p_logo_url text default null,
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
  v_logo text := nullif(btrim(coalesce(p_logo_url, '')), '');
  v_mensaje text := nullif(btrim(regexp_replace(coalesce(p_mensaje, ''), '\s+', ' ', 'g')), '');
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

  if v_color not in ('#1f2937', '#0a5c47', '#0f766e', '#1d4ed8', '#4338ca', '#9f1239', '#9a3412', '#78350f') then
    raise exception 'COLOR_INVALIDO';
  end if;

  -- Solo una URL pública del bucket logos dentro de la carpeta de ESTE negocio.
  if v_logo is not null and (
       v_logo !~ '^https://[a-z0-9.-]+/storage/v1/object/public/logos/'
       or position('/storage/v1/object/public/logos/' || v_negocio.id::text || '/' in v_logo) = 0
       or v_logo ~ '\.\.'
       or length(v_logo) > 500
     ) then
    raise exception 'LOGO_INVALIDO';
  end if;

  if v_mensaje is not null and length(v_mensaje) > 40 then
    raise exception 'MENSAJE_INVALIDO';
  end if;

  update public.negocios
  set color_principal = v_color,
      logo_url = coalesce(v_logo, ''),
      mensaje_gracias = v_mensaje
  where id = v_negocio.id
  returning * into v_negocio;

  return jsonb_build_object(
    'color', v_negocio.color_principal,
    'logo_url', nullif(v_negocio.logo_url, ''),
    'mensaje', v_negocio.mensaje_gracias
  );
end;
$$;

revoke all on function public.guardar_tarjeta(text, text, text) from public, anon, authenticated;
grant execute on function public.guardar_tarjeta(text, text, text) to authenticated;


-- ═══ 4. Comprobaciones finales ═══
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'logos' and public) then
    raise exception 'Falta el bucket público logos.';
  end if;
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname in ('logos_dueno_subir', 'logos_dueno_cambiar', 'logos_dueno_borrar')) <> 3 then
    raise exception 'Faltan las políticas del bucket logos.';
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
  if not has_column_privilege('authenticated', 'public.negocios', 'mensaje_gracias', 'select') then
    raise exception 'authenticated debe poder leer mensaje_gracias.';
  end if;
end;
$$;


commit;


-- ═══════════════════════════════════════════════════════════════════════
-- PRUEBAS (después de aplicar; un bloque a la vez; terminan en rollback)
-- ═══════════════════════════════════════════════════════════════════════
/*

-- ═══ PRUEBA 1: guardar color y mensaje ═══
-- Esperado: {"color": "#1d4ed8", "logo_url": null, "mensaje": "¡Gracias por volver!"}
begin;
select set_config('prueba.dueno', p.user_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where p.role = 'owner' and n.activo is true order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select public.guardar_tarjeta('#1D4ED8', null, '  ¡Gracias   por volver!  ');
rollback;


-- ═══ PRUEBA 2: color fuera de la paleta ═══
-- Esperado: ERROR: COLOR_INVALIDO
begin;
select set_config('prueba.dueno', p.user_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where p.role = 'owner' and n.activo is true order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select public.guardar_tarjeta('#ff00ff');
rollback;


-- ═══ PRUEBA 3: logo de otro negocio ═══
-- Esperado: ERROR: LOGO_INVALIDO
begin;
select set_config('prueba.dueno', p.user_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where p.role = 'owner' and n.activo is true order by p.created_at limit 1;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('prueba.dueno'), 'role', 'authenticated')::text, true);
select public.guardar_tarjeta('#1f2937',
  'https://ejemplo.supabase.co/storage/v1/object/public/logos/00000000-0000-0000-0000-000000000000/logo.png');
rollback;

*/
