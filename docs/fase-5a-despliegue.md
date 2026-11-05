# Paso 5A: panel del administrador de Sello

Pantalla `#/admin` para dar de alta negocios piloto, ver sus totales y desactivarlos. Solo para cuentas que estén en la tabla `admins`. Nunca muestra datos de clientes (solo conteos).

## Qué se agregó

| Pieza | Archivo |
|---|---|
| Tabla `admins`, `es_admin()`, `admin_negocios()`, `admin_cambiar_activo()`, `alta_negocio()` | `supabase/fase-5a.sql` |
| Edge Function que crea la cuenta del dueño + negocio | `supabase/functions/crear-negocio/index.ts` |
| Pantalla `#/admin`, botón "Admin" en la barra del dueño, "Tu contraseña" en Personalización | `src/pages.js` |
| Login y ruteo para una cuenta admin sin negocio propio | `src/auth.js`, `src/main.js` |

Negocio nuevo: meta 10, premio "Un café gratis", mensaje "¡Gracias por tu visita!", zona `America/Cancun`, color verde de Sello (`#0a5c47`), límites por defecto de la tabla (3 códigos activos, 10 minutos, 1 visita al día, 10 capturas manuales).

## 1. SQL (editor SQL de Supabase)

1. Revisa y corre `supabase/fase-5a.sql` completo. Si una comprobación falla, no se aplica nada.
2. Date de alta como administrador:
   - Authentication → Users → copia tu **User UID**.
   - En el editor SQL: `insert into public.admins (user_id) values ('TU-USER-UID');`
3. Pruebas: al final del archivo, un bloque a la vez (todos terminan en `rollback`).

## 2. Edge Function (terminal, en la carpeta del proyecto)

```bash
npx supabase login
npx supabase functions deploy crear-negocio --project-ref <REF>
```

- No pongas `--no-verify-jwt`.
- `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` las pone Supabase dentro de la función. **No las configures a mano ni las pongas en `.env` o en el código.**
- Si ya configuraste `ORIGENES_PERMITIDOS` para `crear-mesero`, aplica también a esta función (es un secreto del proyecto).

## 3. Probar

1. Entra con tu cuenta → abre `#/admin` (si también eres dueño, aparece "Admin" en la barra de abajo).
2. "Crear negocio" con un correo nuevo → copia o comparte la contraseña temporal.
3. En otra ventana privada entra con ese correo: debe llegar a la bienvenida del dueño. En Personalización → Tu contraseña, cámbiala.
4. En `#/admin`, "Desactivar" ese negocio: el dueño queda fuera al recargar y no puede volver a entrar. "Activar" lo regresa.
5. Con una cuenta que NO esté en `admins`, abrir `#/admin` debe mandarla a su pantalla normal.

Errores de la función: Supabase → Edge Functions → crear-negocio → Logs (nunca muestran correos ni contraseñas).
