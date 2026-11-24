begin;
do $$
declare
  v_negocio constant uuid := '9f98217b-056b-419e-beeb-99315fd48a26';
  v_dueno uuid;
  v_mesero uuid;
  v_admin uuid;
  v_hoy date;
  v_registrados integer;
  r jsonb;
  v_err text;
  v_n integer;
  v_total_negocios integer;
  v_dueno_admin boolean;
begin
  select p.user_id into v_dueno from public.profiles p
  where p.negocio_id = v_negocio and p.role = 'owner' and p.activo order by p.created_at limit 1;
  if v_dueno is null then raise exception 'FALLÓ 0: dopamina no tiene dueño activo.'; end if;
  select p.user_id into v_mesero from public.profiles p
  where p.role = 'mesero' and p.activo order by (p.negocio_id = v_negocio) desc, p.created_at limit 1;
  select a.user_id into v_admin from public.admins a limit 1;
  select count(*) into v_total_negocios from public.negocios;   -- antes de cambiar de rol (RLS)
  -- admins está cerrada: se consulta antes de cambiar de rol.
  select exists (select 1 from public.admins a where a.user_id = v_dueno) into v_dueno_admin;
  select (now() at time zone coalesce(nullif(n.zona_horaria, ''), 'America/Cancun'))::date into v_hoy
  from public.negocios n where n.id = v_negocio;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_dueno, 'role', 'authenticated')::text, true);

  -- 1. Todo: el último total = clientes_registrados, termina hoy, sube o se
  --    queda igual, máx. 365 puntos, fechas en orden, sin teléfonos.
  v_registrados := (public.resumen_inicio()->>'clientes_registrados')::integer;
  r := public.grafica_clientes();
  v_n := jsonb_array_length(r->'puntos');
  if (r->>'total')::integer <> v_registrados then raise exception 'FALLÓ 1a: total % vs registrados %', r->>'total', v_registrados; end if;
  if v_registrados > 0 then
    if (r->'puntos'->(v_n - 1)->>'total')::integer <> v_registrados then raise exception 'FALLÓ 1b: último total no coincide: %', r->'puntos'->(v_n - 1); end if;
    if (r->'puntos'->(v_n - 1)->>'fecha')::date <> v_hoy then raise exception 'FALLÓ 1c: el último punto debe ser hoy: %', r->'puntos'->(v_n - 1); end if;
  end if;
  if v_n > 365 then raise exception 'FALLÓ 1d: % puntos (máx. 365)', v_n; end if;
  if exists (
    select 1 from jsonb_array_elements(r->'puntos') with ordinality a(p, i)
    join jsonb_array_elements(r->'puntos') with ordinality b(p, i) on b.i = a.i + 1
    where (b.p->>'fecha')::date <= (a.p->>'fecha')::date or (b.p->>'total')::integer < (a.p->>'total')::integer
  ) then raise exception 'FALLÓ 1e: fechas fuera de orden o total que baja.'; end if;
  if r::text ~ '\+[0-9]{8,}|nombre|telefono' then raise exception 'FALLÓ 1f: la gráfica trae datos de clientes.'; end if;
  raise notice '1 grafica_clientes() OK: % puntos, total %, por %, alta %', v_n, r->>'total', r->>'por', r->>'alta';

  -- 2. Últimos 30 días: máx. 30 puntos y el mismo total final.
  r := public.grafica_clientes(30);
  v_n := jsonb_array_length(r->'puntos');
  if v_n > 30 or (v_registrados > 0 and (r->'puntos'->(v_n - 1)->>'total')::integer <> v_registrados) then
    raise exception 'FALLÓ 2: 30 días: %', r;
  end if;
  v_err := null;
  begin perform public.grafica_clientes(0); exception when others then v_err := sqlerrm; end;
  if v_err is distinct from 'DIAS_INVALIDOS' then raise exception 'FALLÓ 2b: esperaba DIAS_INVALIDOS, salió %', coalesce(v_err, '(sin error)'); end if;

  -- 3. Teléfono del dueño: normaliza, rechaza basura y se puede quitar.
  r := public.guardar_telefono_dueno('998 123 4567');
  if r->>'telefono_dueno' <> '+529981234567' or public.mi_telefono_dueno()->>'telefono_dueno' <> '+529981234567' then
    raise exception 'FALLÓ 3a: %', r;
  end if;
  v_err := null;
  begin perform public.guardar_telefono_dueno('abc'); exception when others then v_err := sqlerrm; end;
  if v_err is distinct from 'TELEFONO_INVALIDO' then raise exception 'FALLÓ 3b: salió %', coalesce(v_err, '(sin error)'); end if;
  if public.guardar_telefono_dueno('')->>'telefono_dueno' is not null then raise exception 'FALLÓ 3c: vacío debía quitarlo.'; end if;
  v_err := null;
  begin perform count(telefono_dueno) from public.negocios; exception when insufficient_privilege then v_err := 'denegado'; end;
  if v_err is null then raise exception 'FALLÓ 3d: authenticated pudo leer telefono_dueno directo.'; end if;

  -- 4. guardar_tarjeta: acepta #rrggbb (en minúsculas) y rechaza otros formatos.
  r := public.guardar_tarjeta('#ABCDEF', null, null);
  if r->>'color' <> '#abcdef' then raise exception 'FALLÓ 4a: %', r; end if;
  foreach v_err in array array['abcdef', '#12345', '#12345g', 'rojo'] loop
    begin
      perform public.guardar_tarjeta(v_err, null, null);
      raise exception 'FALLÓ 4b: aceptó %', v_err;
    exception when others then
      if sqlerrm <> 'COLOR_INVALIDO' then raise; end if;
    end;
  end loop;

  -- 5. admin_logros: el dueño no entra (salvo que también sea admin).
  if v_dueno_admin then
    raise notice '5 OMITIDA: el dueño de dopamina también es admin';
  else
    v_err := null;
    begin perform public.admin_logros(); exception when others then v_err := sqlerrm; end;
    if v_err is distinct from 'Acceso denegado' then raise exception 'FALLÓ 5a: dueño en admin_logros salió %', coalesce(v_err, '(sin error)'); end if;
  end if;
  raise notice '2-5 30 días, errores, teléfono y color OK';

  -- 6. Mesero: sin gráfica ni teléfono.
  if v_mesero is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_mesero, 'role', 'authenticated')::text, true);
    v_err := null;
    begin perform public.grafica_clientes(); exception when others then v_err := sqlerrm; end;
    if v_err is distinct from 'Acceso denegado' then raise exception 'FALLÓ 6a: mesero en gráfica salió %', coalesce(v_err, '(sin error)'); end if;
    v_err := null;
    begin perform public.mi_telefono_dueno(); exception when others then v_err := sqlerrm; end;
    if v_err is distinct from 'Acceso denegado' then raise exception 'FALLÓ 6b: mesero en teléfono salió %', coalesce(v_err, '(sin error)'); end if;
    v_err := null;
    begin perform public.admin_logros(); exception when others then v_err := sqlerrm; end;
    if v_err is distinct from 'Acceso denegado' then raise exception 'FALLÓ 6c: mesero en admin_logros salió %', coalesce(v_err, '(sin error)'); end if;
  end if;

  -- 7. Admin: lista de todos los negocios y recientes en orden (máx. 50).
  if v_admin is null then
    raise notice '7 admin OMITIDA: no hay filas en admins';
  else
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    r := public.admin_logros();
    if jsonb_array_length(r->'negocios') <> v_total_negocios then raise exception 'FALLÓ 7a: faltan negocios.'; end if;
    if jsonb_array_length(r->'recientes') > 50 then raise exception 'FALLÓ 7b: más de 50 recientes.'; end if;
    if exists (
      select 1 from jsonb_array_elements(r->'recientes') with ordinality a(p, i)
      join jsonb_array_elements(r->'recientes') with ordinality b(p, i) on b.i = a.i + 1
      where (b.p->>'celebrado_en')::timestamptz > (a.p->>'celebrado_en')::timestamptz
    ) then raise exception 'FALLÓ 7c: recientes fuera de orden.'; end if;
    if r::text ~ '"(nombre_cliente|ultimos4|clientes)"\s*:' then raise exception 'FALLÓ 7d: trae datos de clientes.'; end if;
    v_err := null;
    begin r := public.admin_guardar_telefono_dueno(v_negocio, '+1 415 555 0100'); exception when others then v_err := sqlerrm; end;
    if v_err is not null then raise exception 'FALLÓ 7e: el admin no pudo guardar un número de EE. UU.: %', v_err; end if;
    if r->>'telefono_dueno' is distinct from '+14155550100' then
      raise exception 'FALLÓ 7f: el número de EE. UU. debía quedar +14155550100 (no confundirse con uno mexicano): %', r;
    end if;
    r := public.admin_logros();   -- para el NOTICE de abajo
    raise notice '6-7 mesero y admin OK (% negocios, % recientes)', jsonb_array_length(r->'negocios'), jsonb_array_length(r->'recientes');
  end if;

  -- 8. Anon: sin permiso.
  set local role anon;
  v_err := null;
  begin perform public.grafica_clientes(); exception when insufficient_privilege then v_err := 'denegado'; end;
  if v_err is null then raise exception 'FALLÓ 8a: anon ejecutó grafica_clientes.'; end if;
  v_err := null;
  begin perform public.admin_logros(); exception when insufficient_privilege then v_err := 'denegado'; end;
  if v_err is null then raise exception 'FALLÓ 8b: anon ejecutó admin_logros.'; end if;

  raise notice 'OK: fase 9 pasó todas las pruebas';
end;
$$;
rollback;
