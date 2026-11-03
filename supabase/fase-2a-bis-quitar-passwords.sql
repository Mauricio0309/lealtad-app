-- Fase 2A-bis: eliminar negocios.password y negocios.password_hash.
-- Guardaban la contraseña del dueño en texto plano (password_hash también era
-- texto plano: el panel admin copiaba ahí la misma contraseña). El login ya usa
-- Supabase Auth, así que nadie las necesita.
-- Todo va en UNA transacción. Correr completo en el editor SQL de Supabase.

begin;


-- ═══ 0. Las columnas deben existir ═══
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'negocios'
      and column_name in ('password', 'password_hash')
  ) then
    raise exception 'negocios.password y negocios.password_hash ya no existen; este paso ya se aplicó.';
  end if;
end;
$$;


-- ═══ 1. Nada en la base debe depender de esas columnas ═══
-- Dos revisiones, porque Postgres registra las dependencias de forma distinta:
--   a) Vistas, políticas, restricciones, índices y triggers: quedan anotados en
--      pg_depend apuntando a la columna.
--   b) Funciones plpgsql o sql normales: Postgres NO anota qué columnas usan,
--      así que se busca el nombre de la columna dentro de su código.
-- Si algo aparece, se detiene y lo lista; no se borra nada.
do $$
declare
  dependencias text;
  funciones text;
begin
  select string_agg(pg_describe_object(d.classid, d.objid, d.objsubid), ', ')
  into dependencias
  from pg_depend d
  join pg_attribute a
    on a.attrelid = d.refobjid and a.attnum = d.refobjsubid
  where d.refclassid = 'pg_class'::regclass
    and d.refobjid = 'public.negocios'::regclass
    and a.attname in ('password', 'password_hash')
    -- Se excluye la dependencia de la columna con su propia tabla.
    and not (d.classid = 'pg_class'::regclass and d.objid = 'public.negocios'::regclass);

  if dependencias is not null then
    raise exception 'No se borra nada. Dependen de las columnas: %', dependencias;
  end if;

  -- Funciones de la app (se excluyen las de Postgres, Supabase y extensiones).
  select string_agg(p.oid::regprocedure::text, ', ')
  into funciones
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname not in (
      'pg_catalog', 'information_schema', 'pg_toast',
      'auth', 'storage', 'realtime', '_realtime', 'extensions', 'graphql',
      'graphql_public', 'vault', 'pgsodium', 'pgsodium_masks', 'pgbouncer',
      'supabase_functions', 'supabase_migrations', 'net', 'cron'
    )
    and not exists (
      select 1 from pg_depend e
      where e.classid = 'pg_proc'::regclass and e.objid = p.oid and e.deptype = 'e'
    )
    and p.prosrc ~* '\mpassword(_hash)?\M';

  if funciones is not null then
    raise exception 'No se borra nada. Estas funciones mencionan password o password_hash: %', funciones;
  end if;
end;
$$;


-- ═══ 2. Borrar las columnas ═══
-- Sin "cascade": si a pesar de las revisiones algo dependiera de ellas,
-- Postgres se niega y la transacción entera se deshace.
alter table public.negocios
  drop column password,
  drop column password_hash;


commit;
