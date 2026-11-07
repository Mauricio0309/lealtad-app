begin;

-- RLS replaces any earlier policies so no permissive legacy policy remains.
do $$
declare
  table_name text;
  policy_row record;
begin
  foreach table_name in array array['profiles', 'negocios', 'clientes', 'visitas', 'niveles', 'canjes'] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      for policy_row in
        select policyname
        from pg_policies
        where schemaname = 'public' and tablename = table_name
      loop
        execute format('drop policy %I on public.%I', policy_row.policyname, table_name);
      end loop;
      execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    end if;
  end loop;
end;
$$;

create or replace function public.user_has_business_role(p_business_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.negocio_id = p_business_id
      and p.role = any (p_roles)
  );
$$;

revoke all on function public.user_has_business_role(uuid, text[]) from public, anon, authenticated;
grant execute on function public.user_has_business_role(uuid, text[]) to authenticated;

create policy profiles_select_self
on public.profiles for select to authenticated
using (user_id = auth.uid());

create policy negocios_select_member
on public.negocios for select to authenticated
using (public.user_has_business_role(id, array['owner', 'mesero']));

create policy negocios_update_owner
on public.negocios for update to authenticated
using (public.user_has_business_role(id, array['owner']))
with check (public.user_has_business_role(id, array['owner']));

create policy clientes_select_member
on public.clientes for select to authenticated
using (public.user_has_business_role(negocio_id, array['owner', 'mesero']));

create policy visitas_select_member
on public.visitas for select to authenticated
using (public.user_has_business_role(negocio_id, array['owner', 'mesero']));

create policy niveles_select_member
on public.niveles for select to authenticated
using (public.user_has_business_role(negocio_id, array['owner', 'mesero']));

create policy niveles_manage_owner
on public.niveles for all to authenticated
using (public.user_has_business_role(negocio_id, array['owner']))
with check (public.user_has_business_role(negocio_id, array['owner']));

grant select on public.profiles, public.clientes, public.visitas, public.niveles to authenticated;
grant select (id, nombre, activo, meta_puntos, color_principal, emoji_negocio, descripcion, logo_url)
on public.negocios to authenticated;
grant update (emoji_negocio, color_principal, descripcion) on public.negocios to authenticated;
grant insert, update, delete on public.niveles to authenticated;

do $$
begin
  if to_regclass('public.canjes') is not null then
    revoke all on table public.canjes from anon, authenticated;
  end if;
  if exists (
    select 1
    from public.clientes
    group by negocio_id, telefono
    having count(*) > 1
  ) then
    raise exception 'Hay teléfonos duplicados por negocio en clientes; resuélvelos antes de crear el índice único.';
  end if;
end;
$$;

create unique index if not exists clientes_negocio_telefono_uidx
on public.clientes (negocio_id, telefono);

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
    'logo_url', n.logo_url,
    'emoji_negocio', n.emoji_negocio,
    'descripcion', n.descripcion,
    'meta_puntos', n.meta_puntos,
    'color_principal', n.color_principal
  )
  from public.negocios n
  where n.id = p_business_id and n.activo is true;
$$;

create or replace function public.public_get_landing(p_business_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'business', public.public_get_business(p_business_id),
    'levels', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nombre', l.nombre,
        'emoji', l.emoji,
        'visitas_minimas', l.visitas_minimas,
        'premio_bienvenida', l.premio_bienvenida
      ) order by l.visitas_minimas)
      from public.niveles l where l.negocio_id = p_business_id
    ), '[]'::jsonb),
    'customer_count', (select count(*) from public.clientes c where c.negocio_id = p_business_id),
    'visit_count', (select count(*) from public.visitas v where v.negocio_id = p_business_id)
  )
  where public.public_get_business(p_business_id) is not null;
$$;

create or replace function public.public_customer_exists(p_business_id uuid, p_phone text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clientes c
    join public.negocios n on n.id = c.negocio_id
    where c.negocio_id = p_business_id
      and c.telefono = btrim(p_phone)
      and n.activo is true
  );
$$;

create or replace function public.public_register_customer(p_business_id uuid, p_phone text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_client_id uuid;
begin
  if public.public_get_business(p_business_id) is null then
    raise exception 'Negocio no disponible';
  end if;
  if length(btrim(p_phone)) < 8 or length(btrim(p_phone)) > 20 then
    raise exception 'Teléfono no válido';
  end if;
  if length(btrim(p_name)) < 1 or length(btrim(p_name)) > 60 then
    raise exception 'Nombre no válido';
  end if;

  select c.id into new_client_id
  from public.clientes c
  where c.negocio_id = p_business_id and c.telefono = btrim(p_phone)
  limit 1;

  if new_client_id is not null then
    return jsonb_build_object('status', 'exists');
  end if;

  insert into public.clientes (nombre, telefono, negocio_id, puntos_actuales, total_visitas)
  values (btrim(p_name), btrim(p_phone), p_business_id, 0, 0)
  returning id into new_client_id;

  return jsonb_build_object('status', 'created', 'client_id', new_client_id);
exception
  when unique_violation then
    return jsonb_build_object('status', 'exists');
end;
$$;

create or replace function public.public_get_customer_card(p_business_id uuid, p_phone text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'business', public.public_get_business(n.id),
    'total_visits', c.total_visitas,
    'levels', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nombre', l.nombre,
        'emoji', l.emoji,
        'visitas_minimas', l.visitas_minimas,
        'premio_bienvenida', l.premio_bienvenida
      ) order by l.visitas_minimas)
      from public.niveles l where l.negocio_id = n.id
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(h.entry order by h.visit_date desc)
      from (
        select jsonb_build_object('fecha', v.fecha) as entry, v.fecha as visit_date
        from public.visitas v
        where v.cliente_id = c.id and v.negocio_id = n.id
        order by v.fecha desc
        limit 8
      ) h
    ), '[]'::jsonb)
  )
  from public.clientes c
  join public.negocios n on n.id = c.negocio_id
  where c.negocio_id = p_business_id
    and c.telefono = btrim(p_phone)
    and n.activo is true;
$$;

create or replace function public.record_visit_temporary(p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  client_row public.clientes%rowtype;
begin
  select c.* into client_row
  from public.clientes c
  where c.id = p_client_id
  for update;

  if client_row.id is null or not public.user_has_business_role(client_row.negocio_id, array['owner', 'mesero']) then
    raise exception 'Acceso denegado';
  end if;

  if exists (
    select 1
    from public.visitas v
    where v.cliente_id = client_row.id
      and v.negocio_id = client_row.negocio_id
      and v.fecha::date = current_date
  ) then
    raise exception 'VISIT_ALREADY_RECORDED_TODAY';
  end if;

  insert into public.visitas (cliente_id, negocio_id, puntos_sumados)
  values (client_row.id, client_row.negocio_id, 1);

  update public.clientes
  set puntos_actuales = coalesce(puntos_actuales, 0) + 1,
      total_visitas = coalesce(total_visitas, 0) + 1
  where id = client_row.id
  returning * into client_row;

  return jsonb_build_object('total_visitas', client_row.total_visitas);
end;
$$;

create or replace function public.get_kiosk_progress(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  business_id uuid;
  progress jsonb;
begin
  select p.negocio_id into business_id
  from public.profiles p
  where p.user_id = auth.uid() and p.role = 'owner';

  if business_id is null then
    raise exception 'Acceso denegado';
  end if;

  progress := public.public_get_customer_card(business_id, p_phone);
  if progress is null then
    return null;
  end if;

  return jsonb_build_object(
    'total_visits', progress->'total_visits',
    'next_level', (
      select jsonb_build_object('nombre', l->>'nombre', 'visitas_minimas', (l->>'visitas_minimas')::integer)
      from jsonb_array_elements(progress->'levels') l
      where (l->>'visitas_minimas')::integer > (progress->>'total_visits')::integer
      order by (l->>'visitas_minimas')::integer
      limit 1
    )
  );
end;
$$;

revoke all on function public.public_get_business(uuid) from public, anon, authenticated;
revoke all on function public.public_get_landing(uuid) from public, anon, authenticated;
revoke all on function public.public_customer_exists(uuid, text) from public, anon, authenticated;
revoke all on function public.public_register_customer(uuid, text, text) from public, anon, authenticated;
revoke all on function public.public_get_customer_card(uuid, text) from public, anon, authenticated;
revoke all on function public.record_visit_temporary(uuid) from public, anon, authenticated;
revoke all on function public.get_kiosk_progress(text) from public, anon, authenticated;

grant execute on function public.public_get_business(uuid) to anon, authenticated;
grant execute on function public.public_get_landing(uuid) to anon, authenticated;
grant execute on function public.public_customer_exists(uuid, text) to anon, authenticated;
grant execute on function public.public_register_customer(uuid, text, text) to anon, authenticated;
grant execute on function public.public_get_customer_card(uuid, text) to anon, authenticated;
grant execute on function public.record_visit_temporary(uuid) to authenticated;
grant execute on function public.get_kiosk_progress(text) to authenticated;

commit;