-- listar-negocios.sql
-- SOLO LECTURA: un único SELECT. No crea, cambia ni borra nada.
--
-- Muestra cada negocio con su id, nombre, si está activo y sus conteos:
--   clientes   = clientes registrados en el negocio
--   visitas    = visitas registradas (cualquier origen: QR o captura manual)
--   canjes     = premios entregados (canjes con estado 'entregado'; los
--                pendientes, cancelados o caducados no cuentan como premio)
--   meseros    = meseros dados de alta (total, activos o no)
--
-- Cada conteo es una subconsulta independiente para que no se multipliquen
-- entre sí (un JOIN de clientes × visitas × canjes inflaría los números).
--
-- Cómo correrlo: Supabase → SQL Editor → pegar este archivo → Run.

select
  n.id,
  n.nombre,
  n.activo,
  (select count(*) from public.clientes c where c.negocio_id = n.id)                              as clientes,
  (select count(*) from public.visitas  v where v.negocio_id = n.id)                              as visitas,
  (select count(*) from public.canjes   k where k.negocio_id = n.id and k.estado = 'entregado')   as canjes,
  (select count(*) from public.profiles p where p.negocio_id = n.id and p.role = 'mesero')         as meseros
from public.negocios n
order by n.fecha_creacion, n.nombre;
