# Paso 4C: desplegar el alta de meseros

La pestaña "Equipo" necesita dos cosas en Supabase: el SQL y la Edge Function `crear-mesero`. Hasta que estén, la pestaña muestra "No pudimos cargar tu equipo".

## 1. SQL (editor SQL de Supabase)

En este orden, cada uno completo (los que ya corriste no se repiten):

1. `supabase/fase-3-canje.sql`
2. `supabase/fase-4.sql`
3. `supabase/fase-4c.sql`

Cada archivo se revisa solo al final; si algo no cuadra, no se aplica nada. Las pruebas van comentadas al final de `fase-4c.sql` (un bloque a la vez).

## 2. Edge Function (terminal, en la carpeta del proyecto)

Tu `<REF>` es el identificador del proyecto: está en la URL del panel de Supabase (`supabase.com/dashboard/project/<REF>`) o en Settings → General.

```bash
npx supabase login
npx supabase functions deploy crear-mesero --project-ref <REF>
```

- No pongas `--no-verify-jwt`: la verificación del JWT en la entrada debe quedar activada.
- `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` las pone Supabase solo dentro de la función. **No las configures a mano, no las pongas en `.env` ni en el código.**

Opcional, recomendado: que solo tu app pueda llamar la función desde el navegador.

```bash
npx supabase secrets set ORIGENES_PERMITIDOS=https://tu-dominio.com --project-ref <REF>
```

(Varios dominios separados por coma, por ejemplo el de producción y `http://localhost:5173`.)

## 3. Ajustes de Auth (panel de Supabase)

- Authentication → Sessions: deja **apagados** "Time-box user sessions" e "Inactivity timeout". Así la sesión del mesero no caduca y no tiene que volver a entrar.
- Authentication → Providers → Email: debe estar activo. La función crea las cuentas ya confirmadas (no se manda correo).
- Si subiste los requisitos de contraseña: las generadas tienen 14 caracteres (`Kx7m-Qp4t-Wz9r`) con mayúscula, minúscula, número y guion.

## 4. Probar

1. Como dueño: Mi panel → Equipo → Agregar mesero. Copia o comparte la contraseña.
2. En otro celular: entra con ese correo y contraseña. Cierra y vuelve a abrir la app: debe seguir dentro.
3. Como dueño: "Nueva contraseña": la anterior deja de servir para entrar.
4. Como dueño: "Desactivar". En el celular del mesero, "Cobré una cuenta" debe fallar ("Tu sesión ya no es válida") y al reabrir la app debe pedir entrar con el aviso de cuenta desactivada.

Errores de la función: panel de Supabase → Edge Functions → crear-mesero → Logs (nunca muestran correos ni contraseñas).
