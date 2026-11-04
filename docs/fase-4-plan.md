# Fase 4: panel del dueño

Estado: **en curso**. No pasar a lo siguiente sin OK del dueño del proyecto.

Objetivo: el dueño abre el panel y en 3 segundos entiende si Sello le sirve. Una pantalla (máximo 1.5 de alto en celular), números grandes, textos sencillos y sin jerga. Una sola gráfica sencilla (4D).

## Avance

| Paso | Estado | Archivo |
|---|---|---|
| 4A Base de datos y funciones | ⏳ Escrito, falta revisar y ejecutar | `supabase/fase-4.sql` |
| 4B Panel, programa y bienvenida | ⏳ Escrito, se prueba después de 4A | `src/pages.js` |

## Qué ve el dueño (en este orden)

1. **Grande:** "Tus clientes volvieron N veces esta semana · ≈ $X en ventas (estimado)". Sin ticket promedio: "N visitas de clientes que regresaron" y una invitación discreta a decir cuánto gasta un cliente.
2. Clientes registrados · Visitas esta semana (▲▼ contra la anterior) · "Regresaron: N de cada 10".
3. (Oculto hasta WhatsApp, ver 4D) "Dejaron de venir (más de 21 días): N" → al tocar, la lista (primer nombre, ···4821, última visita, visitas).
4. Premios entregados esta semana (y su costo estimado) · Listos para canjear.
5. Tabla por mesero con la alerta "Revisar".

La configuración (programa, personal, personalización, exportar) pasa a una pestaña "Ajustes" para que el resumen quepa en una pantalla.

## Reglas

- "Esta semana" = los últimos 7 días contando hoy, en la zona horaria del negocio; "la anterior" = los 7 días antes de esos. Así un lunes no aparece siempre en rojo contra una semana completa.
- Visita repetida = cualquier visita que no sea la primera del cliente.
- Ventas estimadas = visitas repetidas × ticket promedio. Si el dueño no lo ha puesto, no se inventa: se muestra el conteo.
- Inactivo = su última visita fue hace más de 21 días.
- Todo lo calcula el servidor con funciones solo para el dueño. El navegador nunca recibe el teléfono completo en el resumen.

## Bandera "Revisar" por mesero (umbrales iniciales, a ajustar con el piloto)

- 5 o más códigos esta semana y menos de la mitad reclamados.
- 5 o más capturas a mano y más capturas que códigos reclamados.
- Se bloqueó por códigos de canje incorrectos en los últimos 7 días. (El número de bloqueos que se muestra es el total histórico: la Fase 3 no guarda la fecha de cada uno.)

## Base de datos

- `negocios.ticket_promedio` y `negocios.costo_premio` (opcionales) y `profiles.nombre`.
- `guardar_programa` acepta ticket y costo (opcionales).
- `resumen_dueno()`, `clientes_inactivos()`, `resumen_meseros()`.
- El mesero deja de leer `clientes` y `visitas` directo; solo el dueño y las funciones.

## Bienvenida

Tres pasos: elegir premio y meta, dar de alta a los meseros, hacer una visita de prueba.

## Fuera de esta fase

- Pantalla para que el dueño dé de alta meseros y les ponga nombre (hoy `profiles.nombre` se llena a mano).
- `max_manuales_dia` en "Programa".
- Página pública (`#/landing`) sin niveles.

## Rediseño visual del dueño

- Login, bienvenida, panel y ajustes con estilo sobrio (estilos en `inyectarEstilosDueno`, todo dentro de `.ow`; mesero y cliente sin cambios).
- "Tarjeta de tus clientes": color, logo y mensaje de agradecimiento con vista previa (ver 4E).
- Aviso de privacidad del dueño: una línea en el login con enlace a `#/terminos`.

## 4C: alta de meseros (pestaña "Equipo")

- El dueño agrega meseros (nombre y correo), les genera una nueva contraseña o los desactiva. La contraseña se muestra una sola vez, con "Copiar" y "Compartir por WhatsApp".
- Servidor: Edge Function `supabase/functions/crear-mesero` (solo dueños; el negocio sale de su sesión; solo crea meseros; máximo 10 activos) y `supabase/fase-4c.sql` (profiles.activo, equipo_negocio, alta_mesero y baja_mesero).
- Un mesero desactivado no pasa `user_has_business_role`, así que no puede generar códigos, capturar a mano ni canjear aunque tenga la sesión abierta; sus códigos pendientes se cancelan y Auth lo bloquea.
- Despliegue: `docs/fase-4c-despliegue.md`.

## 4D: gráfica en "Mi panel"

- Selector "Semana · Mes" y un control "Visitas · Clientes" dentro de la misma tarjeta (debajo de las cifras).
- Visitas: barras azules (#065FD4, solo en la gráfica) y una raya azul grisáceo claro con el periodo anterior. Semana = por día contra los 7 días anteriores; Mes = 4 semanas contra las 4 anteriores.
- Clientes: línea azul de clientes registrados acumulados y "+N nuevos".
- Si las visitas bajan: "Las visitas bajaron frente al periodo anterior." Sin rojo, sin enlaces.
- Con menos de 7 días desde la primera visita: "Tu gráfica aparece cuando tengas una semana de visitas".
- SVG propio, sin librerías; se dibuja al ancho real y se toca una columna para leer su número. Tabla oculta para lectores de pantalla.
- Servidor: grafica_dueno(periodo) en supabase/fase-4d.sql (solo dueño, series ya agregadas, sin clientes ni teléfonos). El mismo archivo quita a los meseros desactivados de resumen_meseros.
- "Dejaron de venir" queda oculto (MOSTRAR_INACTIVOS = false en src/pages.js) hasta la fase de WhatsApp; clientes_inactivos() y la hoja siguen listas.
- "Mes" solo se activa con 14 días de datos o más (antes: "Disponible con 2 semanas de datos").
- "Copiar" contraseña del mesero: si el navegador no deja copiar (sin https), la deja seleccionada y dice "cópiala manualmente".

## 4E: la tarjeta se siente del negocio

- Cliente (tarjeta y pantallas de éxito): logo grande, nombre y mensaje de agradecimiento del negocio; sin logo, un círculo con la inicial en su color. Sello va pequeño arriba y "Hecho con Sello" abajo (constante MOSTRAR_PIE_SELLO en src/pages.js, para quitarlo en Pro).
- Dueño (Personalización → Tarjeta de tus clientes): color, logo y mensaje (máx. 40, con plantillas), vista previa en vivo y un solo "Guardar".
- Logo: solo PNG, JPG o WebP (nunca SVG). El navegador lo vuelve a dibujar a máx. 512 px (sin metadatos) y lo sube como archivo nuevo a logos/<negocio_id>/; el anterior se borra al guardar.
- Servidor: supabase/fase-4e.sql (reemplaza a fase-4b-tarjeta.sql). Bucket público "logos" de 1 MB donde solo el dueño escribe en su carpeta; guardar_tarjeta valida color, que el logo exista en su carpeta y el mensaje; public_get_business entrega logo y mensaje (y ya no logo_url). El color deja de cambiarse con update directo.

## 4F: ayudas de primera vez (mesero y dueño)

- Una burbuja corta (máx. 12 palabras) señala el elemento real con un resaltado suave, solo cuando está a la vista por primera vez y de una en una. "Entendido" (o usar el elemento) la da por vista; "Saltar todo" las da por vistas todas. Escape también cierra.
- Mesero: "Cobré una cuenta", el primer QR, la primera pantalla verde (esa vez no se cierra sola) y las casillas del canje.
- Dueño: ventas estimadas, ticket promedio y números excluidos. "Ver ayuda otra vez" al final de Personalización las reinicia en ese celular.
- Se guardan en localStorage (`sello_ayudas_vistas`); si falla, no se repiten en la sesión. Motor propio (`ayudasMotor` en src/pages.js), sin librerías. La burbuja se coloca arriba o abajo sin tapar los botones principales.
- Siempre (no es de primera vez): al crear un mesero o generar su contraseña, "Guarda esta contraseña ahora: no se vuelve a mostrar" queda fijo arriba de la hoja.
