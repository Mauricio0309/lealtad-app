-- Fase 2A: base de datos para el código QR de un solo uso (estructura y permisos, sin RPC).
-- Todo va en UNA transacción: si cualquier paso falla, no se aplica nada.
-- Correr completo en el editor SQL de Supabase (sin seleccionar partes).

begin;


-- ═══ 0. Comprobaciones previas ═══
-- Si la base ya no coincide con el diagnóstico 2.0 (alguien agregó clientes,
-- la fase ya se aplicó, etc.), se aborta antes de tocar nada.
do $$
declare
  jose public.clientes%rowtype;
begin
  if to_regclass('public.codigos') is not null then
    raise exception 'La fase 2A ya se aplicó (la tabla codigos existe).';
  end if;

  -- visitas.fecha es "timestamp sin zona" y se llenó con now(); se interpreta como UTC.
  if current_setting('TimeZone') not in ('UTC', 'Etc/UTC') then
    raise exception 'La zona horaria de la sesión es %, se esperaba UTC. Revisar antes de convertir visitas.fecha.',
      current_setting('TimeZone');
  end if;

  if (select count(*) from public.clientes) <> 11 then
    raise exception 'Se esperaban 11 clientes (diagnóstico 2.0) y hay %. Volver a correr el 2.0.',
      (select count(*) from public.clientes);
  end if;

  select * into jose
  from public.clientes
  where id = '89fec50b-fd22-4833-aa14-7f6f3c2065f7'
    and negocio_id = '0e849c23-ae76-44c2-b984-38b463817837';

  if jose.id is null then
    raise exception 'No se encontró al cliente Jose del diagnóstico 2.0.';
  end if;
  if length(regexp_replace(coalesce(jose.telefono, ''), '\D', '', 'g')) <> 11 then
    raise exception 'El teléfono de Jose ya no tiene 11 dígitos; volver a correr el 2.0.';
  end if;
  if (select count(*) from public.visitas where cliente_id = jose.id) <> 1 then
    raise exception 'Se esperaba 1 visita de Jose.';
  end if;
  if exists (select 1 from public.canjes where cliente_id = jose.id) then
    raise exception 'Jose tiene canjes; no estaban en el diagnóstico. Revisar antes de borrar.';
  end if;

  if exists (select 1 from public.visitas where fecha is null) then
    raise exception 'Hay visitas sin fecha; no se puede calcular su día local.';
  end if;
end;
$$;


-- ═══ 1. Función para normalizar teléfonos de México a E.164 ═══
-- Una sola definición de la regla del 2.0, que usan este script y después
-- las funciones del cliente (2C) y la captura manual (2H).
-- Devuelve null si el número no encaja. No se expone a la API.
create function public.normalizar_telefono_mx(p_telefono text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when length(d.digitos) = 10 then '+52' || d.digitos
    when length(d.digitos) = 12 and d.digitos like '52%' then '+' || d.digitos
    when length(d.digitos) = 13 and d.digitos like '521%' then '+52' || right(d.digitos, 10)
  end
  from (select regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g') as digitos) d;
$$;

revoke all on function public.normalizar_telefono_mx(text) from public, anon, authenticated;


-- ═══ 2. Clientes: borrar a Jose y convertir los demás a +52 ═══
-- visitas.cliente_id y canjes.cliente_id no tienen "on delete": la base
-- impide borrar un cliente que tenga visitas. Por eso primero va su visita.
do $$
declare
  filas integer;
begin
  delete from public.visitas
  where cliente_id = '89fec50b-fd22-4833-aa14-7f6f3c2065f7';
  get diagnostics filas = row_count;
  if filas <> 1 then raise exception 'Se borraron % visitas de Jose, se esperaba 1.', filas; end if;

  delete from public.clientes
  where id = '89fec50b-fd22-4833-aa14-7f6f3c2065f7';
  get diagnostics filas = row_count;
  if filas <> 1 then raise exception 'Se borraron % clientes, se esperaba 1.', filas; end if;

  -- Tras borrar a Jose, todos deben encajar y ninguno debe chocar dentro de su negocio.
  if exists (select 1 from public.clientes where public.normalizar_telefono_mx(telefono) is null) then
    raise exception 'Queda un teléfono que no encaja en E.164.';
  end if;
  if exists (
    select 1 from public.clientes
    group by negocio_id, public.normalizar_telefono_mx(telefono)
    having count(*) > 1
  ) then
    raise exception 'Dos clientes del mismo negocio quedarían con el mismo teléfono.';
  end if;

  update public.clientes
  set telefono = public.normalizar_telefono_mx(telefono)
  where telefono is distinct from public.normalizar_telefono_mx(telefono);
  get diagnostics filas = row_count;
  if filas <> 10 then raise exception 'Se convirtieron % teléfonos, se esperaban 10.', filas; end if;
end;
$$;

-- Desde aquí la base rechaza cualquier teléfono que no sea +52 y 10 dígitos.
alter table public.clientes
  add constraint clientes_telefono_e164_mx check (telefono ~ '^\+52[0-9]{10}$');

-- Falso hasta que exista la verificación por WhatsApp (fase futura).
alter table public.clientes
  add column verificado boolean not null default false;


-- ═══ 3. Negocios: configuración del programa ═══
-- Valores por defecto del CLAUDE.md. Los límites evitan configuraciones absurdas
-- desde el panel del dueño (2G).
alter table public.negocios
  add column zona_horaria text not null default 'America/Cancun',
  add column max_codigos_activos integer not null default 3,
  add column minutos_codigo integer not null default 10,
  add column limite_visitas_dia integer not null default 1,
  add column premio text not null default '';

alter table public.negocios
  add constraint negocios_max_codigos_activos_rango check (max_codigos_activos between 1 and 50),
  add constraint negocios_minutos_codigo_rango check (minutos_codigo between 1 and 60),
  add constraint negocios_limite_visitas_dia_rango check (limite_visitas_dia between 1 and 10),
  add constraint negocios_premio_largo check (length(premio) <= 80);

-- negocios usa permisos por columna: hay que dar lectura explícita a las nuevas.
-- Nadie las modifica directo; el dueño lo hará con una RPC en 2G.
grant select (zona_horaria, max_codigos_activos, minutos_codigo, limite_visitas_dia, premio)
on public.negocios to authenticated;


-- ═══ 4. Visitas: fecha con zona horaria, origen y día local ═══
-- fecha pasa de "timestamp sin zona" (hora UTC sin decirlo) a timestamptz.
-- Así el instante no es ambiguo y el navegador lo muestra en la hora correcta.
alter table public.visitas
  alter column fecha type timestamptz using fecha at time zone 'UTC',
  alter column fecha set not null;

-- origen: 'qr' (reclamo del código), 'manual' (2H) o 'antigua'.
-- El valor por defecto 'antigua' marca las visitas que ya existían y las que
-- siga creando record_visit_temporary hasta que se borre en 2G.
alter table public.visitas
  add column origen text not null default 'antigua',
  add column mesero_id uuid references auth.users (id) on delete set null,
  add column dia_local date;

alter table public.visitas
  add constraint visitas_origen_valido check (origen in ('qr', 'manual', 'antigua'));

-- Día de la visita en la zona del negocio (no en UTC): una visita a las 11:30 pm
-- en Cancún cuenta para ese día, no para el siguiente.
update public.visitas v
set dia_local = (v.fecha at time zone coalesce(
  (select n.zona_horaria from public.negocios n where n.id = v.negocio_id),
  'America/Cancun'
))::date;

alter table public.visitas
  alter column dia_local set not null;

-- dia_local lo calcula siempre la base al insertar, venga de la función que venga.
-- Nadie tiene que acordarse de llenarlo y nadie puede mandarlo mal.
create function public.visitas_poner_dia_local()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.dia_local := (new.fecha at time zone coalesce(
    (select n.zona_horaria from public.negocios n where n.id = new.negocio_id),
    'America/Cancun'
  ))::date;
  return new;
end;
$$;

revoke all on function public.visitas_poner_dia_local() from public, anon, authenticated;

create trigger visitas_dia_local
before insert or update of fecha, negocio_id on public.visitas
for each row execute function public.visitas_poner_dia_local();

-- Para contar rápido las visitas de un cliente en un día (límite diario, 2C).
create index visitas_cliente_dia_idx on public.visitas (cliente_id, dia_local);


-- ═══ 5. Tabla codigos (el QR de un solo uso) ═══
-- El código lo genera el servidor (2B). Va en la URL #/c/<codigo>, por eso solo
-- admite letras, números, "-" y "_", y al menos 32 caracteres.
create table public.codigos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  codigo text not null unique,
  origen text not null default 'mesero_pwa',
  creado_por uuid references auth.users (id) on delete set null,
  creado_en timestamptz not null default now(),
  expira_en timestamptz not null,
  cancelado_en timestamptz,
  reclamado_en timestamptz,
  cliente_id uuid references public.clientes (id) on delete set null,
  visita_id uuid references public.visitas (id) on delete set null,
  -- Vacío hasta la fase del QR en el ticket.
  ticket_id text,
  -- Lo que ve el mesero al reclamarse: "✓ Ana (···4821) sumó su punto, 4/10".
  aviso_nombre text,
  aviso_ultimos4 text,
  aviso_puntos integer,
  aviso_meta integer,
  aviso_premio_listo boolean,

  constraint codigos_formato check (codigo ~ '^[A-Za-z0-9_-]{32,64}$'),
  constraint codigos_origen_valido check (origen in ('mesero_pwa', 'ticket_pos')),
  constraint codigos_expira_despues check (expira_en > creado_en),
  constraint codigos_no_reclamado_y_cancelado check (reclamado_en is null or cancelado_en is null),
  constraint codigos_ultimos4_formato check (aviso_ultimos4 ~ '^[0-9]{4}$')
);

-- Una caja no puede pedir dos códigos para el mismo ticket (idempotencia, fase futura).
create unique index codigos_negocio_ticket_uidx
on public.codigos (negocio_id, ticket_id) where ticket_id is not null;

-- Para contar los códigos activos de cada mesero (límite de 2B).
create index codigos_activos_por_mesero_idx
on public.codigos (creado_por, expira_en) where reclamado_en is null and cancelado_en is null;

-- Para el reporte por mesero del dueño.
create index codigos_negocio_creado_idx on public.codigos (negocio_id, creado_en);

-- Visita ligada al código que la generó. Única: un código da como máximo una visita.
alter table public.visitas
  add column codigo_id uuid references public.codigos (id) on delete set null;

create unique index visitas_codigo_uidx
on public.visitas (codigo_id) where codigo_id is not null;


-- ═══ 6. Tabla numeros_excluidos (personal que no gana puntos) ═══
create table public.numeros_excluidos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  telefono text not null,
  creado_en timestamptz not null default now(),

  constraint numeros_excluidos_telefono_e164_mx check (telefono ~ '^\+52[0-9]{10}$'),
  constraint numeros_excluidos_negocio_telefono_key unique (negocio_id, telefono)
);


-- ═══ 7. Tabla dispositivos_cliente (teléfono recordado) ═══
-- Guarda solo el hash SHA-256 del token (32 bytes), nunca el token en claro:
-- si alguien lee esta tabla, no puede hacerse pasar por el cliente.
create table public.dispositivos_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  token_hash bytea not null unique,
  creado_en timestamptz not null default now(),
  ultimo_uso timestamptz not null default now(),

  constraint dispositivos_cliente_hash_largo check (octet_length(token_hash) = 32)
);

create index dispositivos_cliente_cliente_idx on public.dispositivos_cliente (cliente_id);


-- ═══ 8. Permisos y RLS de las tablas nuevas ═══
-- Supabase da TODOS los permisos de las tablas nuevas a anon y authenticated
-- por defecto. Se quitan y se dan solo los necesarios. Nadie escribe directo:
-- todo pasará por funciones RPC (2B, 2C, 2G, 2H).
alter table public.codigos enable row level security;
alter table public.numeros_excluidos enable row level security;
alter table public.dispositivos_cliente enable row level security;

revoke all on table public.codigos from public, anon, authenticated;
revoke all on table public.numeros_excluidos from public, anon, authenticated;
revoke all on table public.dispositivos_cliente from public, anon, authenticated;

-- codigos: el mesero ve solo los suyos; el dueño ve todos los de su negocio.
create policy codigos_select_propios
on public.codigos for select to authenticated
using (
  creado_por = auth.uid()
  and public.user_has_business_role(negocio_id, array['owner', 'mesero'])
);

create policy codigos_select_owner
on public.codigos for select to authenticated
using (public.user_has_business_role(negocio_id, array['owner']));

grant select on public.codigos to authenticated;

-- numeros_excluidos: solo el dueño.
create policy numeros_excluidos_select_owner
on public.numeros_excluidos for select to authenticated
using (public.user_has_business_role(negocio_id, array['owner']));

grant select on public.numeros_excluidos to authenticated;

-- dispositivos_cliente: sin políticas ni permisos. Solo la leen las RPC.


-- ═══ 9. Cerrar la tabla premios (hallazgo del 2.0, fuera del plan original) ═══
-- Tiene la política "acceso publico premios" (todo para todos) y anon puede
-- insertar y modificar. La app no la usa (el premio del MVP es negocios.premio).
-- Se cierra igual que canjes en la fase 3: RLS sin políticas y sin permisos.
drop policy if exists "acceso publico premios" on public.premios;
alter table public.premios enable row level security;
revoke all on table public.premios from public, anon, authenticated;


-- ═══ 10. Tiempo real ═══
-- La pantalla del mesero (2F) escucha los cambios de sus códigos. Realtime
-- respeta RLS: cada mesero solo recibe los suyos.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'No existe la publicación supabase_realtime.';
  end if;
  alter publication supabase_realtime add table public.codigos;
end;
$$;


commit;
