-- limpiar-pruebas.sql
-- Borra los negocios de prueba y todo lo que cuelga de ellos.
-- NO EJECUTADO. Para revisar.
--
-- MODO PRUEBA: termina en ROLLBACK, así que no se guarda nada. Corre el archivo
-- completo en el editor SQL de Supabase, revisa el resultado y, si cuadra,
-- cambia la última línea "rollback;" por "commit;" y córrelo otra vez.
--
-- NUNCA se toca dopamina: 9f98217b-056b-419e-beeb-99315fd48a26.
--
-- Orden de borrado (llaves foráneas, de hojas a raíz):
--   canjes → canje_intentos → codigos → visitas → dispositivos_cliente →
--   numeros_excluidos → clientes → profiles → niveles → premios → negocios
--   niveles y premios son tablas viejas (antes de la Fase 2) que siguen
--   apuntando a negocios. niveles se borraría sola en cascada, pero premios NO
--   tiene cascada y, si tuviera filas de estos negocios, impediría borrarlos.
--   Se borran explícitamente para que el reporte las cuente.
--   canjes tampoco tiene cascada (a propósito: es historial), por eso va primero.
--   codigos y visitas se apuntan entre sí con "on delete set null": borrar
--   codigos primero solo deja visitas.codigo_id en null, y luego se borran.
--
-- Se aborta (y no se borra nada) si:
--   - dopamina aparece en la lista por error;
--   - algún usuario con perfil en estos negocios está en public.admins;
--   - algún usuario con perfil en estos negocios tiene perfil en dopamina.
--     (Hoy profiles.user_id es llave primaria, así que un usuario solo tiene un
--     perfil y esto no puede pasar; la comprobación queda como seguro por si
--     esa regla cambia algún día.)
--
-- Auth NO se toca: este archivo no puede borrar usuarios de auth.users.
-- Al final lista los user_id que quedan sin perfil, para borrarlos a mano en
-- Supabase → Authentication → Users. Al borrarlos ahí, sus referencias en
-- visitas.mesero_id, codigos.creado_por, canjes.confirmado_por y
-- visitas.anulada_por pasan a null solas (on delete set null).
--
-- El editor muestra solo el último resultado: el reporte final es una sola
-- consulta (tipo, nombre, valor) justo antes del rollback/commit.

begin;

-- ═══ 1. Lista de negocios a borrar ═══
create temp table _limpiar_negocios (id uuid primary key) on commit drop;
insert into _limpiar_negocios (id) values
  ('e6eb4571-22c2-4d01-a86e-42f0d94e642e'),
  ('4a770d3e-45f3-4505-b3a1-fe1a5a3a047b'),
  ('0ef84f73-cd47-4707-84aa-9663339907de'),
  ('94194484-c9e3-457c-a180-5898d701c871'),
  ('0e849c23-ae76-44c2-b984-38b463817837'),
  ('a17d2d9c-60f6-4d5a-9850-ff8263816984'),
  ('0d2ca7b0-8ff9-4a92-87be-cc6ed4567b4a'),
  ('67b6052b-e8de-458c-be19-98a8fb64c6bd');

-- Usuarios con perfil en esos negocios. Se guardan ANTES de borrar profiles
-- para limpiar canje_intentos y para el reporte de huérfanos en Auth.
create temp table _limpiar_usuarios (user_id uuid primary key) on commit drop;
insert into _limpiar_usuarios (user_id)
select p.user_id
from public.profiles p
where p.negocio_id in (select id from _limpiar_negocios);

-- Filas borradas por tabla, para el reporte final.
create temp table _limpiar_reporte (orden int, tabla text, filas bigint) on commit drop;


-- ═══ 2. Comprobaciones: si alguna falla, se aborta todo ═══
do $$
declare
  v_dopamina constant uuid := '9f98217b-056b-419e-beeb-99315fd48a26';
  v_lista text;
begin
  if exists (select 1 from _limpiar_negocios where id = v_dopamina) then
    raise exception 'ABORTADO: dopamina (%) está en la lista de negocios a borrar.', v_dopamina;
  end if;

  select string_agg(u.user_id::text, ', ') into v_lista
  from _limpiar_usuarios u
  join public.admins a on a.user_id = u.user_id;
  if v_lista is not null then
    raise exception 'ABORTADO: estos usuarios están en public.admins: %', v_lista;
  end if;

  select string_agg(u.user_id::text, ', ') into v_lista
  from _limpiar_usuarios u
  join public.profiles p on p.user_id = u.user_id
  where p.negocio_id = v_dopamina;
  if v_lista is not null then
    raise exception 'ABORTADO: estos usuarios tienen perfil en dopamina: %', v_lista;
  end if;

  -- Solo aviso: ids de la lista que ya no existen (no impide seguir).
  select string_agg(l.id::text, ', ') into v_lista
  from _limpiar_negocios l
  where not exists (select 1 from public.negocios n where n.id = l.id);
  if v_lista is not null then
    raise notice 'Aviso: estos negocios no existen (ya borrados?): %', v_lista;
  end if;
end
$$;


-- ═══ 3. Borrado, en orden de llaves foráneas ═══
with d as (
  delete from public.canjes
  where negocio_id in (select id from _limpiar_negocios)
  returning 1
)
insert into _limpiar_reporte select 1, 'canjes', count(*) from d;

with d as (
  delete from public.canje_intentos
  where usuario_id in (select user_id from _limpiar_usuarios)
  returning 1
)
insert into _limpiar_reporte select 2, 'canje_intentos', count(*) from d;

with d as (
  delete from public.codigos
  where negocio_id in (select id from _limpiar_negocios)
  returning 1
)
insert into _limpiar_reporte select 3, 'codigos', count(*) from d;

with d as (
  delete from public.visitas
  where negocio_id in (select id from _limpiar_negocios)
  returning 1
)
insert into _limpiar_reporte select 4, 'visitas', count(*) from d;

with d as (
  delete from public.dispositivos_cliente
  where cliente_id in (
    select c.id from public.clientes c
    where c.negocio_id in (select id from _limpiar_negocios)
  )
  returning 1
)
insert into _limpiar_reporte select 5, 'dispositivos_cliente', count(*) from d;

with d as (
  delete from public.numeros_excluidos
  where negocio_id in (select id from _limpiar_negocios)
  returning 1
)
insert into _limpiar_reporte select 6, 'numeros_excluidos', count(*) from d;

with d as (
  delete from public.clientes
  where negocio_id in (select id from _limpiar_negocios)
  returning 1
)
insert into _limpiar_reporte select 7, 'clientes', count(*) from d;

with d as (
  delete from public.profiles
  where negocio_id in (select id from _limpiar_negocios)
  returning 1
)
insert into _limpiar_reporte select 8, 'profiles', count(*) from d;

with d as (
  delete from public.niveles
  where negocio_id in (select id from _limpiar_negocios)
  returning 1
)
insert into _limpiar_reporte select 9, 'niveles', count(*) from d;

with d as (
  delete from public.premios
  where negocio_id in (select id from _limpiar_negocios)
  returning 1
)
insert into _limpiar_reporte select 10, 'premios', count(*) from d;

with d as (
  delete from public.negocios
  where id in (select id from _limpiar_negocios)
  returning 1
)
insert into _limpiar_reporte select 11, 'negocios', count(*) from d;


-- ═══ 4. Reporte ═══
-- tipo = 'borradas':     nombre = tabla, valor = filas borradas.
-- tipo = 'auth_huerfano': nombre = user_id, valor = correo. Borrar a mano en
--                         Authentication → Users (quedaron sin perfil).
select tipo, nombre, valor
from (
  select 1 as grupo, r.orden, 'borradas' as tipo, r.tabla as nombre, r.filas::text as valor
  from _limpiar_reporte r
  union all
  select 2, 0, 'auth_huerfano', u.user_id::text, coalesce(au.email, '(sin correo)')
  from _limpiar_usuarios u
  join auth.users au on au.id = u.user_id
  where not exists (select 1 from public.profiles p where p.user_id = u.user_id)
    and not exists (select 1 from public.admins a where a.user_id = u.user_id)
) x
order by grupo, orden, nombre;

-- MODO PRUEBA: cambia "rollback;" por "commit;" para borrar de verdad.
rollback;
