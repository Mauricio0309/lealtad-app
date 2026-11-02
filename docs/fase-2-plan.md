# Fase 2: código QR de un solo uso y reclamo

Estado: plan aprobado. Paso actual: **2.0 (preparación)**. No pasar a un paso nuevo sin OK del dueño del proyecto.

Objetivo: el mesero genera un código/QR de un solo uso al cobrar y el cliente lo reclama desde su celular. El reclamo es atómico en el servidor. Reemplaza `record_visit_temporary` y el flujo viejo de teclear el teléfono.

## Problemas del código actual que esta fase cierra

1. `public_get_customer_card(negocio, teléfono)` es anónima y la URL `#/cliente/<negocio>/<teléfono>` expone el número: cualquiera puede probar números y ver progreso ajeno. Se reemplaza por una tarjeta que se abre con un token del teléfono del cliente.
2. El QR fijo (`#/negocio/<id>`) permite registrar números nuevos sin compra vía `public_register_customer` (anónima).
3. El aviso de premio (`localStorage` `sello_premio_*`) se guarda en el teléfono del cajero, no en el del cliente; nunca le llega.

## Decisiones tomadas

1. **Meta y premio:** `negocios.meta_puntos` es el "/10" (progreso = `puntos_actuales / meta_puntos`). Se agrega `negocios.premio` (texto) para el premio del MVP. La tabla `niveles` se queda en la base de datos, pero la tarjeta nueva no la muestra.
2. **Plan B (captura manual):** sí, como paso **2H**, al final de la fase. Puede registrar clientes nuevos o existentes, queda con `origen = 'manual'`, respeta las mismas reglas (límite diario, números excluidos) y aparece en el reporte por mesero.
3. **Código no se gasta** si el cliente ya sumó hoy o si el número está excluido. El mesero puede cancelarlo o usarlo con otro cliente.
4. **QR fijo del mostrador:** solo muestra la tarjeta si el teléfono ya está recordado (token); si no, dice "Pide tu código al pagar". La consulta por número con límite de intentos queda para después.
5. **Teléfonos existentes:** todos son de México y son datos de prueba. Los que no encajen en E.164 o choquen al normalizar se **borran**, no se arreglan (previa revisión).
6. **Fuera de esta fase:** modo sin internet (lote de códigos y cola local) y canje con dos llaves. El esquema les deja lugar (`ticket_id`, `origen`).

## Reglas que aplican en toda la fase

- Código aleatorio y largo (~32 caracteres), generado **en el servidor**, de un solo uso, caduca en `negocios.minutos_codigo` (10 por defecto).
- Límite de códigos activos por mesero: `negocios.max_codigos_activos` (3 por defecto). Activo = sin reclamar, sin cancelar y sin caducar.
- Un punto por cuenta: el primero que reclama el código se lleva el punto.
- Límite de visitas por número al día: `negocios.limite_visitas_dia` (1 por defecto), calculado con `negocios.zona_horaria` (`America/Cancun`), no en UTC.
- Teléfono en E.164 (`+52` y 10 dígitos). `clientes.verificado` en falso por defecto. Solo primer nombre.
- Los clientes nuevos solo se crean reclamando un código válido (o por captura manual del mesero, 2H).
- Números del personal en `numeros_excluidos`: no ganan puntos.
- Cliente que regresa: confirmación de un toque ("¿Eres Ana ···4821? Sumar"). Nunca se suma solo por el token.
- Nadie escribe directo en las tablas: todo pasa por funciones RPC con `security definer`.

## Pasos

### 2.0 Preparación (sin cambiar la app)

- Exportar el esquema real de Supabase (tablas, columnas, restricciones, índices, políticas, permisos, funciones, triggers, Realtime, extensiones) a `supabase/schema-actual.csv`. El repo no tiene la definición de las tablas base.
- Reporte de teléfonos: cuáles no encajan en E.164 y cuáles chocarían al normalizar dentro del mismo negocio.
- Regla de normalización (México): quitar todo lo que no sea dígito; 10 dígitos → `+52` + dígitos; 12 dígitos que empiezan con `52` → `+` + dígitos; 13 dígitos que empiezan con `521` → `+52` + últimos 10. Cualquier otro caso no encaja.
- Prueba: revisar el reporte y aprobar qué clientes se borran.

### 2A Base de datos (estructura y permisos, sin lógica)

- `negocios`: `zona_horaria` (`America/Cancun`), `max_codigos_activos` (3), `minutos_codigo` (10), `limite_visitas_dia` (1), `premio` (texto).
- `clientes`: borrar los que no encajen o choquen (decisión 5), normalizar el resto a E.164 y agregar una restricción que solo acepte `^\+52[0-9]{10}$`. Agregar `verificado` (falso por defecto).
- Tabla nueva `codigos`: id, negocio, código (único), `origen` (`mesero_pwa` / `ticket_pos`), `creado_por`, `creado_en`, `expira_en`, `cancelado_en`, `reclamado_en`, `cliente_id`, `visita_id`, `ticket_id` (vacío, para la fase de tickets; único por negocio). Además, datos para el aviso del mesero: nombre, últimos 4 dígitos, puntos y meta tras el reclamo, y si alcanzó la meta.
- `visitas`: `codigo_id`, `mesero_id`, `origen` (`qr` / `manual` / `antigua`), `dia_local` (fecha según la zona horaria del negocio).
- Tabla nueva `numeros_excluidos` (negocio, teléfono E.164).
- Tabla nueva `dispositivos_cliente`: hash del token que recuerda al cliente, cliente, creado, último uso. El token nunca se guarda en claro.
- RLS: el mesero ve solo sus códigos y el dueño ve todos los de su negocio; `numeros_excluidos` solo para el dueño; `dispositivos_cliente` sin acceso. Sin escritura directa.
- Agregar `codigos` a la publicación de Realtime.
- Prueba: correr el SQL; revisar teléfonos con `+52`; como anónimo, leer `codigos`, `numeros_excluidos` y `dispositivos_cliente` debe dar vacío o error.

### 2B Funciones RPC del mesero

- `crear_codigo()`: valida rol (mesero o dueño) y negocio activo; si ya tiene `max_codigos_activos` activos, responde `LIMITE_CODIGOS`; si no, crea el código y devuelve código y `expira_en`.
- `cancelar_codigo(id)`: solo códigos propios y activos.
- `mis_codigos_pendientes()`.
- Prueba (consola del navegador con sesión de mesero): 3 códigos sí, el 4º falla; cancelar uno libera lugar; sin sesión, "Acceso denegado".

### 2C Funciones RPC del cliente

- `ver_codigo(codigo, token)`: estado del código (válido / caducado / usado) y nombre del negocio; si el token corresponde a un cliente del negocio, devuelve "Ana ···4821". No suma nada.
- `reclamar_codigo(...)`: con token (cliente que regresa) o con teléfono y primer nombre (nuevo o "No soy yo"). En una sola transacción:
  1. Bloquear el código; validar que no esté reclamado, cancelado ni caducado.
  2. Si el número está excluido → `NUMERO_EXCLUIDO` (el código no se gasta).
  3. Buscar o crear el cliente (única vía de alta, junto con 2H). Si el número ya existe, se ignora el nombre escrito; el mesero ve el nombre real.
  4. Bloquear al cliente y contar sus visitas de hoy (zona del negocio). Si llegó al límite → `YA_SUMO_HOY` (el código no se gasta).
  5. Insertar la visita (`origen = 'qr'`), sumar el punto, marcar el código como reclamado y escribir los datos del aviso.
  6. Devolver un token nuevo para recordar el teléfono.
- `tarjeta_por_token(token)`: reemplaza a la tarjeta por teléfono. Muestra puntos / meta y el premio, sin niveles.
- Prueba:

| Caso | Resultado esperado |
|---|---|
| Código válido, número nuevo | Cliente creado, 1/10 |
| Mismo código otra vez | `CODIGO_USADO` |
| Código de más de 10 min | `CODIGO_CADUCADO` |
| Segundo código el mismo día | `YA_SUMO_HOY`, el código sigue activo |
| Número excluido | `NUMERO_EXCLUIDO`, el código sigue activo |
| Dos teléfonos con el mismo código a la vez | Solo uno gana |
| 11:30 pm y 12:10 am hora de Cancún | Las dos cuentan (días distintos) |

### 2D Pantalla del mesero (sin tiempo real)

- `#/cajero` se reemplaza por: botón grande "Cobré una cuenta" → QR a pantalla completa con contador y "Cancelar código"; lista de códigos pendientes y "2 de 3 activos". QR con la librería `qrcode` (ya instalada).
- Prueba: generar un QR en menos de 5 segundos con una mano; mensaje claro al llegar al límite; el QR desaparece al caducar.

### 2E Pantalla del cliente

- `#/c/<codigo>`: si el teléfono está recordado → "¿Eres Ana ···4821? **Sumar**" y "No soy yo"; si no → número (con `+52` puesto) y primer nombre, con aviso de privacidad → "¡Ganaste 1 punto!" → tarjeta.
- `#/tarjeta`: tarjeta por token; el teléfono ya no va en la URL.
- QR fijo `#/negocio/<id>`: tarjeta si hay token; si no, "Pide tu código al pagar" (decisión 4).
- Errores amables: "Este código ya se usó", "Pídele uno nuevo al mesero", "Ya sumaste hoy, vuelve mañana".
- Prueba en iPhone (Safari) y Android: nuevo, regresa, "No soy yo", incógnito (debe pedir número), caducado, usado.

### 2F Tiempo real

- La pantalla del mesero escucha cambios de sus códigos: verde "✓ Ana (···4821) sumó su punto, 4/10"; aviso grande "¡Le toca premio!" si alcanzó la meta.
- Al volver a la app o recuperar señal, recarga los pendientes.
- Prueba: mesero y cliente en dos teléfonos, medir segundos hasta el verde; modo avión un momento y verificar que el aviso llega al volver.

### 2G Configuración del dueño y limpieza

- Panel del dueño: "Códigos activos por mesero", meta, premio y lista "Números del personal (no ganan puntos)".
- Borrar funciones y pantallas viejas (ver tabla abajo).
- Subir la versión de caché de `public/sw.js`.
- Prueba: límite en 5 permite 5 códigos; número excluido no suma; las funciones viejas ya no existen (pruebas anónimas).

### 2H Plan B: captura manual

- RPC `visita_manual(telefono, nombre)` para mesero o dueño: busca o crea el cliente, `origen = 'manual'`, guarda `mesero_id`, mismas reglas (límite diario, números excluidos), devuelve los mismos datos que el aviso del QR.
- Acceso discreto en la pantalla del mesero ("Capturar a mano").
- Reporte por mesero en el panel del dueño: códigos generados, reclamados y capturas manuales.
- Prueba: captura de cliente nuevo y existente; segundo intento el mismo día rechazado; número excluido rechazado; el reporte refleja la captura como manual.

## Riesgos

- Safari puede borrar el token tras 7 días sin abrir la página: siempre queda "escribe tu número" y nunca se suma sin el toque.
- Realtime puede perder avisos con la pantalla apagada: 2F recarga al volver.
- Normalizar teléfonos puede chocar con el índice único `(negocio_id, telefono)`: 2.0 lo detecta y esos registros se borran (decisión 5).

## Qué se reutiliza

- Interfaz: `inyectarEstilos`, `DS`, `toast`, `logoSVG`, `aplicarColorNegocio`, `topbarBrand`, `navBarCajero`.
- Diseño visual de `paginaCliente` (cambia la fuente de datos) y el modal del aviso de privacidad de `initRegistroCliente`.
- Servidor y sesión: `user_has_business_role`, `public_get_business`, `public_get_landing`, `get_kiosk_progress`, todo `auth.js`, librería `qrcode`.

## Qué se borra o reemplaza

| Qué | Por qué |
|---|---|
| `record_visit_temporary` y sus usos (`mostrarCliente`, `initRegistro`) | Lo reemplaza `reclamar_codigo` |
| `public_register_customer`, `public_customer_exists` | Alta sin compra y averiguar números |
| `public_get_customer_card(negocio, teléfono)` | Tarjetas ajenas; la reemplaza `tarjeta_por_token` |
| `paginaRegistro` / `initRegistro` (`#/registro`) | El cajero ya no registra así (lo cubre 2H) |
| `paginaRegistroCliente` / `initRegistroCliente` (`#/registro-cliente/...`) | El registro vive en `#/c/<codigo>` |
| Búsqueda del cajero y botón "+ Registrar visita" | Lo reemplaza "Cobré una cuenta" (y 2H) |
| Rutas `#/cliente/<negocio>/<teléfono>` en `main.js` y `router.js` | El teléfono deja de ir en la URL |
| `localStorage` `sello_premio_*` | Nunca llegaba al cliente |
