-- Fase 2C: pruebas de las funciones del cliente.
-- Copia y corre UN bloque a la vez (de begin a rollback) en el editor SQL de Supabase.
-- Todas terminan en rollback: no queda nada guardado.
-- Usan el primer negocio activo que tenga un mesero o dueño, y códigos de prueba
-- creados directamente. El editor muestra solo el último resultado y se detiene
-- en el primer error: por eso cada caso es un bloque aparte.


-- ═══ PRUEBA 1: código válido con número nuevo ═══
-- Esperado: tarjeta con "nombre": "Ana", "ultimos4": "0001", "puntos": 1,
-- la "meta" del negocio (10 por defecto), "premio_listo": false y 1 visita.
begin;
select set_config('prueba.negocio', p.negocio_id::text, true),
       set_config('prueba.mesero', p.user_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where n.activo is true limit 1;
insert into public.codigos (negocio_id, codigo, creado_por, expira_en)
values (current_setting('prueba.negocio')::uuid, 'prueba-codigo-1-' || repeat('0', 24),
        current_setting('prueba.mesero')::uuid, now() + interval '10 minutes'),
       (current_setting('prueba.negocio')::uuid, 'prueba-codigo-2-' || repeat('0', 24),
        current_setting('prueba.mesero')::uuid, now() + interval '10 minutes');
set local role anon;
select set_config('prueba.token', public.reclamar_codigo(
  'prueba-codigo-1-' || repeat('0', 24), null, '998 000 0001', '  ana maría ')->>'token', true);
select public.tarjeta_por_token(current_setting('prueba.token'));
rollback;


-- ═══ PRUEBA 2: el mismo código otra vez ═══
-- Esperado: ERROR: CODIGO_USADO
begin;
select set_config('prueba.negocio', p.negocio_id::text, true),
       set_config('prueba.mesero', p.user_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where n.activo is true limit 1;
insert into public.codigos (negocio_id, codigo, creado_por, expira_en)
values (current_setting('prueba.negocio')::uuid, 'prueba-codigo-1-' || repeat('0', 24),
        current_setting('prueba.mesero')::uuid, now() + interval '10 minutes'),
       (current_setting('prueba.negocio')::uuid, 'prueba-codigo-2-' || repeat('0', 24),
        current_setting('prueba.mesero')::uuid, now() + interval '10 minutes');
set local role anon;
select public.reclamar_codigo('prueba-codigo-1-' || repeat('0', 24), null, '9980000001', 'Ana');
select public.reclamar_codigo('prueba-codigo-1-' || repeat('0', 24), null, '9980000002', 'Luis');
rollback;


-- ═══ PRUEBA 3: código caducado ═══
-- Esperado: ERROR: CODIGO_CADUCADO
-- (Si quitas el último select, ver_codigo debe responder "estado": "caducado".)
begin;
select set_config('prueba.negocio', p.negocio_id::text, true),
       set_config('prueba.mesero', p.user_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where n.activo is true limit 1;
insert into public.codigos (negocio_id, codigo, creado_por, creado_en, expira_en)
values (current_setting('prueba.negocio')::uuid, 'prueba-codigo-3-' || repeat('0', 24),
        current_setting('prueba.mesero')::uuid, now() - interval '15 minutes', now() - interval '5 minutes');
set local role anon;
select public.ver_codigo('prueba-codigo-3-' || repeat('0', 24));
select public.reclamar_codigo('prueba-codigo-3-' || repeat('0', 24), null, '9980000003', 'Eva');
rollback;


-- ═══ PRUEBA 4: segundo código el mismo día (cliente que regresa, con token) ═══
-- Esperado: ERROR: YA_SUMO_HOY
-- (El error revierte la transacción: el código 2 sigue activo.)
begin;
select set_config('prueba.negocio', p.negocio_id::text, true),
       set_config('prueba.mesero', p.user_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where n.activo is true limit 1;
insert into public.codigos (negocio_id, codigo, creado_por, expira_en)
values (current_setting('prueba.negocio')::uuid, 'prueba-codigo-1-' || repeat('0', 24),
        current_setting('prueba.mesero')::uuid, now() + interval '10 minutes'),
       (current_setting('prueba.negocio')::uuid, 'prueba-codigo-2-' || repeat('0', 24),
        current_setting('prueba.mesero')::uuid, now() + interval '10 minutes');
set local role anon;
select set_config('prueba.token', public.reclamar_codigo(
  'prueba-codigo-1-' || repeat('0', 24), null, '9980000001', 'Ana')->>'token', true);
select public.reclamar_codigo('prueba-codigo-2-' || repeat('0', 24), current_setting('prueba.token'), null, null);
rollback;


-- ═══ PRUEBA 5: número excluido ═══
-- Esperado: ERROR: NUMERO_EXCLUIDO
begin;
select set_config('prueba.negocio', p.negocio_id::text, true),
       set_config('prueba.mesero', p.user_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where n.activo is true limit 1;
insert into public.codigos (negocio_id, codigo, creado_por, expira_en)
values (current_setting('prueba.negocio')::uuid, 'prueba-codigo-1-' || repeat('0', 24),
        current_setting('prueba.mesero')::uuid, now() + interval '10 minutes');
insert into public.numeros_excluidos (negocio_id, telefono)
values (current_setting('prueba.negocio')::uuid, '+529980000009');
set local role anon;
select public.reclamar_codigo('prueba-codigo-1-' || repeat('0', 24), null, '+52 998 000 0009', 'Pepe');
rollback;


-- ═══ PRUEBA 6: 11:30 pm y 12:10 am de Cancún son días distintos ═══
-- Esperado: 2 filas a 40 minutos de distancia con dia_local distinto (ayer y hoy).
-- Supone que el negocio tiene zona_horaria = 'America/Cancun' (el valor por defecto).
begin;
select set_config('prueba.negocio', p.negocio_id::text, true),
       set_config('prueba.mesero', p.user_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where n.activo is true limit 1;
with c as (
  insert into public.clientes (negocio_id, telefono, nombre)
  values (current_setting('prueba.negocio')::uuid, '+529980000005', 'Noche') returning id
)
select set_config('prueba.cliente', c.id::text, true) from c;
insert into public.visitas (cliente_id, negocio_id, fecha) values
  (current_setting('prueba.cliente')::uuid, current_setting('prueba.negocio')::uuid,
   ((now() at time zone 'America/Cancun')::date - 1 + time '23:30') at time zone 'America/Cancun'),
  (current_setting('prueba.cliente')::uuid, current_setting('prueba.negocio')::uuid,
   ((now() at time zone 'America/Cancun')::date + time '00:10') at time zone 'America/Cancun');
select fecha at time zone 'America/Cancun' as hora_cancun, dia_local
from public.visitas where cliente_id = current_setting('prueba.cliente')::uuid order by fecha;
rollback;


-- ═══ PRUEBA 7: el reclamo respeta el día de Cancún ═══
-- El cliente ya tiene una visita de anoche a las 11:30 pm.
-- Esperado: el reclamo de hoy SÍ suma: "puntos": 2.
-- Variante: cambia  - 1 + time '23:30'  por  + time '00:10'  → ERROR: YA_SUMO_HOY
begin;
select set_config('prueba.negocio', p.negocio_id::text, true),
       set_config('prueba.mesero', p.user_id::text, true)
from public.profiles p join public.negocios n on n.id = p.negocio_id
where n.activo is true limit 1;
insert into public.codigos (negocio_id, codigo, creado_por, expira_en)
values (current_setting('prueba.negocio')::uuid, 'prueba-codigo-1-' || repeat('0', 24),
        current_setting('prueba.mesero')::uuid, now() + interval '10 minutes');
with c as (
  insert into public.clientes (negocio_id, telefono, nombre, puntos_actuales, total_visitas)
  values (current_setting('prueba.negocio')::uuid, '+529980000005', 'Noche', 1, 1) returning id
)
select set_config('prueba.cliente', c.id::text, true) from c;
insert into public.visitas (cliente_id, negocio_id, fecha) values
  (current_setting('prueba.cliente')::uuid, current_setting('prueba.negocio')::uuid,
   ((now() at time zone 'America/Cancun')::date - 1 + time '23:30') at time zone 'America/Cancun');
set local role anon;
select public.reclamar_codigo('prueba-codigo-1-' || repeat('0', 24), null, '9980000005', null);
rollback;


-- ═══ PRUEBA EXTRA: código inexistente ═══
-- Esperado: {"estado": "invalido"}, sin datos del negocio.
begin;
set local role anon;
select public.ver_codigo('no-existe');
rollback;
