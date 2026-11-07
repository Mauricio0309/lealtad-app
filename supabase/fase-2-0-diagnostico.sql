-- Fase 2.0: diagnóstico. SOLO LECTURA: ninguna consulta cambia datos.
-- El editor SQL de Supabase muestra solo el resultado de la última consulta,
-- así que corre cada una por separado (selecciónala y "Run selected").


-- ═══ CONSULTA A: esquema actual ═══
-- Guardar el resultado como supabase/schema-actual.csv (Export → CSV).
with esquema (tipo, objeto, definicion, orden) as (
  select '0-tabla', c.relname::text,
         'rls=' || c.relrowsecurity || ' filas_aprox=' || c.reltuples::bigint, 0
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'

  union all
  select '1-columna', c.relname || '.' || a.attname,
         format_type(a.atttypid, a.atttypmod)
           || case when a.attnotnull then ' not null' else '' end
           || coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), ''),
         a.attnum::int
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v')
    and a.attnum > 0 and not a.attisdropped

  union all
  select '2-restriccion', c.conrelid::regclass::text || '.' || c.conname,
         pg_get_constraintdef(c.oid), 0
  from pg_constraint c
  where c.connamespace = 'public'::regnamespace and c.contype in ('p', 'f', 'u', 'c')

  union all
  select '3-indice', i.tablename || '.' || i.indexname, i.indexdef, 0
  from pg_indexes i
  where i.schemaname = 'public'

  union all
  select '4-politica', p.tablename || '.' || p.policyname,
         p.cmd || ' to ' || array_to_string(p.roles, ',')
           || ' using (' || coalesce(p.qual, '') || ')'
           || ' check (' || coalesce(p.with_check, '') || ')', 0
  from pg_policies p
  where p.schemaname = 'public'

  union all
  select '5-permiso-tabla', g.table_name || ' → ' || g.grantee,
         string_agg(g.privilege_type, ', ' order by g.privilege_type), 0
  from information_schema.role_table_grants g
  where g.table_schema = 'public' and g.grantee in ('anon', 'authenticated')
  group by g.table_name, g.grantee

  union all
  select '5-permiso-columna', cp.table_name || ' → ' || cp.grantee || ' (' || cp.privilege_type || ')',
         string_agg(cp.column_name, ', ' order by cp.column_name), 0
  from information_schema.column_privileges cp
  where cp.table_schema = 'public' and cp.grantee in ('anon', 'authenticated')
  group by cp.table_name, cp.grantee, cp.privilege_type

  union all
  select '6-funcion', p.oid::regprocedure::text,
         'permisos=' || coalesce(p.proacl::text, '(por defecto)') || E'\n' || pg_get_functiondef(p.oid), 0
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')

  union all
  select '7-trigger', t.tgrelid::regclass::text || '.' || t.tgname, pg_get_triggerdef(t.oid), 0
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  where not t.tgisinternal and c.relnamespace = 'public'::regnamespace

  union all
  select '8-realtime', pt.pubname::text, pt.schemaname || '.' || pt.tablename, 0
  from pg_publication_tables pt

  union all
  select '9-extension', e.extname::text, e.extversion || ' en ' || e.extnamespace::regnamespace::text, 0
  from pg_extension e

  union all
  select '9-zona-horaria', 'servidor',
         current_setting('TimeZone') || ' | ahora en Cancún: ' || (now() at time zone 'America/Cancun')::text, 0

  union all
  select '9-perfiles', coalesce(pr.role::text, '(sin rol)'), count(*)::text || ' perfiles', 0
  from public.profiles pr
  group by pr.role
)
select tipo, objeto, definicion
from esquema
order by tipo, split_part(objeto, '.', 1), orden, objeto;


-- ═══ CONSULTA B: resumen de teléfonos ═══
with normalizados as (
  select c.id, c.negocio_id, c.telefono,
         case
           when length(d.digitos) = 10 then '+52' || d.digitos
           when length(d.digitos) = 12 and d.digitos like '52%' then '+' || d.digitos
           when length(d.digitos) = 13 and d.digitos like '521%' then '+52' || right(d.digitos, 10)
         end as e164
  from public.clientes c
  cross join lateral (select regexp_replace(coalesce(c.telefono, ''), '\D', '', 'g') as digitos) d
),
marcados as (
  select n.*, count(*) over (partition by n.negocio_id, n.e164) as repetidos
  from normalizados n
)
select count(*) as total_clientes,
       count(*) filter (where e164 is not null and telefono = e164) as ya_en_e164,
       count(*) filter (where e164 is not null and telefono <> e164 and repetidos = 1) as se_pueden_convertir,
       count(*) filter (where e164 is null) as no_encajan,
       count(*) filter (where e164 is not null and repetidos > 1) as chocan
from marcados;


-- ═══ CONSULTA C: detalle de teléfonos que no encajan o chocan ═══
-- Estos son los candidatos a BORRAR (decisión 5). Incluye cuántas visitas perderían.
with normalizados as (
  select c.id, c.negocio_id, c.nombre, c.telefono,
         case
           when length(d.digitos) = 10 then '+52' || d.digitos
           when length(d.digitos) = 12 and d.digitos like '52%' then '+' || d.digitos
           when length(d.digitos) = 13 and d.digitos like '521%' then '+52' || right(d.digitos, 10)
         end as e164
  from public.clientes c
  cross join lateral (select regexp_replace(coalesce(c.telefono, ''), '\D', '', 'g') as digitos) d
),
marcados as (
  select n.*, count(*) over (partition by n.negocio_id, n.e164) as repetidos
  from normalizados n
)
select case when m.e164 is null then 'NO ENCAJA' else 'CHOCA' end as problema,
       m.id, m.negocio_id, m.nombre, m.telefono, m.e164 as quedaria_como,
       (select count(*) from public.visitas v where v.cliente_id = m.id) as visitas
from marcados m
where m.e164 is null or m.repetidos > 1
order by problema, m.negocio_id, m.e164, m.telefono;


-- ═══ CONSULTA D: lo que quedó fuera de la A ═══
-- El editor muestra máximo 100 filas y la A se cortó en "5-permiso-columna".
-- Esta trae el resto sin el código de las funciones, para que quepa.
select 'permiso-tabla' as tipo, g.table_name || ' → ' || g.grantee as objeto,
       string_agg(g.privilege_type, ', ' order by g.privilege_type) as definicion
from information_schema.role_table_grants g
where g.table_schema = 'public' and g.grantee in ('anon', 'authenticated')
group by g.table_name, g.grantee
union all
select 'funcion', p.oid::regprocedure::text, coalesce(p.proacl::text, '(por defecto)')
from pg_proc p
where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
union all
select 'trigger', t.tgrelid::regclass::text || '.' || t.tgname, pg_get_triggerdef(t.oid)
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where not t.tgisinternal and c.relnamespace = 'public'::regnamespace
union all
select 'realtime', pt.pubname::text, pt.schemaname || '.' || pt.tablename
from pg_publication_tables pt
union all
select 'extension', e.extname::text, e.extversion || ' en ' || e.extnamespace::regnamespace::text
from pg_extension e
union all
select 'zona-horaria', 'sesion', current_setting('TimeZone')
order by 1, 2;
