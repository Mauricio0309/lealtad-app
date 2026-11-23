# Sello

App de lealtad por visitas para negocios locales (cafeterías, barberías, taquerías). PWA con Supabase. Proyecto independiente.

## Principio de producto (lo más importante)

Tiene que ser tan fácil de usar que sea tonto no usarla, para los tres actores:

- **Cliente:** sin descargar nada, sin contraseña, sin formularios largos.
- **Mesero:** cada acción en menos de 5 segundos, con una mano, en hora pico.
- **Dueño:** al abrir ve 3 números claros y configura su programa en 2 minutos.

Si una pantalla necesita explicación, está mal diseñada.

## Alcance del MVP (construir SOLO esto primero)

Núcleo: generar QR → reclamar → pantalla de éxito del mesero → canje con dos llaves → los 3 números del dueño.

El MVP NO usa WhatsApp: ningún mensaje automático, ninguna verificación por WhatsApp y ninguna casilla de consentimiento de promociones. Todo ocurre dentro de la PWA: el mesero ve los avisos en su pantalla y el cliente ve su progreso en su tarjeta.

Para que agregar cosas después no obligue a rehacer nada, desde el MVP:
- Guardar el número en formato internacional (E.164).
- Tabla de códigos con el campo `origen` (`mesero_pwa` o `ticket_pos`).
- Tabla de clientes con el campo `verificado` (falso por defecto).

Todo lo demás está en la sección "Futuro y actualizaciones".

## Stack

- PWA (instalable en la pantalla de inicio del mesero; el cliente nunca necesita instalarla).
- Backend: Supabase (Postgres, Auth, Realtime, Edge Functions, Row Level Security).
- Framework de frontend: POR CONFIRMAR (revisar el código existente en este repo).

## Identidad del cliente

- El identificador es el número de WhatsApp. No hay contraseñas ni cuentas tradicionales.
- Al registrarse se pide: número y SOLO primer nombre (campo corto). El nombre es necesario para que el aviso al mesero ("Ana sumó su punto") signifique algo.
- La fecha de cumpleaños NO se pide en el MVP.
- Incluir un aviso de privacidad básico (se guardan números de teléfono).

## Reglas de negocio

- Visita = 1 punto.
- **Un punto por cuenta, no por persona.** El primero que escanea el código de esa cuenta se lleva el punto.
- **Límite: 1 visita por número por día** (configurable por negocio).
- Cada negocio configura cuántas visitas necesita para el premio y cuál es el premio, con plantillas listas.

## Flujo para sumar un punto (flujo principal)

1. El mesero toca "Cobré una cuenta" en su PWA y se genera un código.
2. El código es aleatorio y largo (imposible de adivinar), de un solo uso, caduca en ~10 minutos.
3. Límite de códigos activos por mesero: 3 por defecto, CONFIGURABLE por negocio (en una taquería con mucha rotación 3 se agota rápido). El mesero tiene un botón "Cancelar código" para liberar un lugar si el cliente no escanea.
4. El mesero muestra el QR a pantalla completa, de preferencia mientras se procesa el pago.
5. El cliente escanea con la cámara del celular:
   - **Cliente que regresa:** el teléfono lo recuerda y le muestra UN toque de confirmación: "¿Eres Ana ···4821? Sumar". NUNCA se suma automáticamente solo por la cookie: Safari puede borrar datos (falsos "nuevos") y un celular prestado sumaría el punto a la cuenta equivocada. Si el teléfono no lo recuerda, o toca "No soy yo", se le pide su número.
   - **Cliente nuevo:** escribe número de WhatsApp y primer nombre.
6. El reclamo es una operación ATÓMICA en el servidor: "marcar como reclamado solo si no está reclamado y no ha caducado". La validación nunca ocurre en el teléfono.
7. La pantalla del mesero se actualiza sola en tiempo real: verde con "✓ Ana (···4821) sumó su punto, 4/10". Si el cliente completó su meta, el mesero ve un aviso claro de que le toca premio.
8. El mesero compara el nombre y los últimos 4 dígitos con la persona que tiene enfrente.

## Plan B: captura manual

- Si el cliente no puede escanear, el mesero busca/teclea el número.
- Queda marcada como "manual" en los reportes.
- Aplican las mismas reglas (límite de 1 visita por número al día).

## QR fijo del mostrador

- Solo para CONSULTAR progreso ("Llevas 6/10, te faltan 4"). No suma puntos.
- NO registra clientes nuevos (no hay compra detrás de ese registro).
- Solo muestra progreso, nunca nombre ni otros datos. Limitar intentos por dispositivo/IP para que nadie recorra números.

## Canje de premios (dos llaves)

1. El cliente toca "Canjear mi premio" (solo aparece si completó la meta). Ve un código de 4 dígitos, válido 5 minutos y de un solo uso.
2. El mesero abre "Canjear" en su PWA, escribe el código y ve el premio, el nombre y los últimos 4 dígitos del teléfono del cliente.
3. El mesero confirma la entrega viendo al cliente presente.
4. Se descuentan los puntos, queda registrado qué mesero confirmó y el dueño lo ve en su panel.

Ni el mesero puede canjear sin el teléfono del cliente, ni el cliente sin el mesero.

## Antifraude (acotar, no eliminar)

- El dueño marca los números de su personal como "excluidos" (no ganan puntos).
- Límite de códigos activos por mesero (configurable).
- Reporte por mesero en el panel: códigos generados, reclamados y capturas manuales. Alerta simple si hay mucha diferencia.
- Al canjear, el negocio puede ver el historial de visitas y qué mesero generó cada una.

## Modo sin internet

- La PWA guarda en caché el último estado de la tarjeta del cliente ("actualizado hace X").
- El mesero tiene cola local (IndexedDB): las visitas pendientes se suben cuando regresa la señal. Cada una lleva un id único generado en el teléfono para que el servidor no la cuente dos veces. En pantalla se ve "pendiente de sincronizar".
- La app puede pre-descargar un lote de códigos cuando hay internet, para que el mesero siga generando QR si se cae la señal.
- Cliente nuevo registrándose sí necesita internet (la página del QR es web).

## Pantallas del MVP

- **Mesero:** botón grande "Cobré una cuenta" → QR a pantalla completa con contador y botón "Cancelar código" → pantalla de éxito verde. Botón "Canjear". Lista de códigos pendientes. Acceso discreto a captura manual.
- **Cliente:** escanea → confirmación de un toque o registro (número y primer nombre) → "¡Ganaste 1 punto!" → tarjeta con progreso y premio visible. Botón "Canjear mi premio" cuando aplica.
- **Dueño:** 3 números (clientes registrados, visitas de la semana, clientes que regresaron). Tabla por mesero. Premios canjeados. Configuración del programa (meta, premio, límite de códigos).

## Panel del dueño (estado actual)

- **Resumen**, en este orden: tarjeta principal (verde #0F7B5A: "Ya regresaron N clientes", ventas estimadas y "desde que empezaste · [alta]") → fila de Logros (medallas de los últimos 3 y el próximo más cercano con su barra) → Este mes / Esta semana ("Tu primer mes" si el negocio empezó en el periodo y no hay anterior con datos) → "Clientes en tu programa" (gráfica SVG propia, chips "30 días / Todo") → tarjetas de acción (a 1 visita del premio, no vienen hace 21 días) → Lo que está pasando (5 filas con tiempos relativos en America/Cancun y "Ver toda la actividad" con `actividad_reciente(20)`).
- **Funciones que usa el Resumen:** `resumen_inicio`, `resumen_periodo` ('mes' y 'semana'), `clientes_cerca_premio`, `clientes_inactivos`, `actividad_reciente` y `resumen_meseros` (Fase B, `supabase/fase-7-resumen.sql`), `logros_lista` (fase 8) y `grafica_clientes` (fase 9; "Todo" con `p_dias = null` y "30 días" con `p_dias = 30`, solo al tocar ese chip; también da `alta`, la fecha de alta del negocio). `resumen_dueno`, `grafica_dueno` y `grafica_regresos` siguen en la base, pero ya no se usan desde la app.
- **"Dejaron de venir"** se muestra en el Resumen como tarjeta informativa gris azulada ("N clientes no vienen desde hace 21 días", con su lista al tocar), solo si hay alguno. Ya no existe `MOSTRAR_INACTIVOS`. No tiene botón: la hoja (`abrirListaClientes` en `src/pages.js`) ya acepta una acción por fila para cuando llegue WhatsApp.
- **Logros** (fase 8, `supabase/fase-8-logros.sql`, aplicado): 14 hitos, clientes registrados 10, 25, 50, 100, 250, 500, 1000 y clientes que regresaron 1, 5, 10, 25, 50, 100, 250 (la misma lista en `logros_hitos()` y en `HITOS_LOGRO` de `src/pages.js`). Tabla `logros_celebrados` cerrada (RLS sin policies, sin permisos). `logros_pendientes()` da los alcanzados sin celebrar; `celebrar_logro(tipo, hito)` valida en el servidor y marca ese hito y los menores (idempotente); `logros_lista()` da los celebrados y el próximo de cada tipo. Los conteos salen de `resumen_inicio`.
- **Celebración:** al abrir el Resumen, el mayor hito pendiente de cada tipo (primero regresos), una pantalla a la vez; `celebrar_logro` se llama al mostrarse. Desde la pantalla "Logros" (menú ☰ o la fila del Resumen) se reabre como "LOGRO DESBLOQUEADO" sin volver a llamarlo.
- **Imagen para compartir:** una sola función, `imagenLogro` (PNG 1080×1920 con el color de la tarjeta del negocio, su logo, el número y "¿Y tú? Pregunta cómo unirte"). La frase usa solo Pacifico (`public/fonts/pacifico.woff2`, guardada por el service worker), cargada con FontFace antes de dibujar. **Solo los logros de "clientes registrados" se comparten** (`logroCompartible`): su celebración trae vista previa y "Compartir", y su tarjeta en Logros el ícono. Los de "clientes que regresaron" no: su celebración solo tiene "Seguir" (o "Cerrar" al reabrir). `compartirPNG` se llama directo en el toque con el blob ya listo ("Compartir" se habilita hasta tenerlo) y llama a `navigator.share` antes de cualquier await; si no hay `navigator.canShare({files})` o falla, abre una hoja (`abrirHojaGuardarImagen`) con la imagen grande, "Mantén presionada la imagen para guardarla o compartirla" y "Descargar".
- **Fase 9** (`supabase/fase-9-ajustes.sql`, aplicado; pruebas en `supabase/fase-9-pruebas.sql`): `grafica_clientes(p_dias)`; `admin_logros()` (logros por negocio y recientes con `principal`, para el admin); `negocios.telefono_dueno` (E.164, sin acceso directo por la API) con `fijar_telefono_dueno` (solo service_role, al crear el negocio), `guardar_telefono_dueno` y `mi_telefono_dueno` (dueño, en el menú ☰ "Tu WhatsApp (opcional)") y `admin_guardar_telefono_dueno` (admin); `guardar_tarjeta` ahora valida el formato del color (`^#[0-9a-f]{6}$`) en vez de una lista fija.
- **Paleta de la tarjeta:** 12 colores con contraste ≥ 4.5:1 con texto blanco (`COLORES_TARJETA`); un color guardado fuera de la lista sale como "Tu color actual". Si el color es claro, el texto se pone oscuro (`--negocio-texto`, `--negocio-tinta`).
- **Banderas de plan** (`src/pages.js`): `PLAN_COLOR_LIBRE_SOLO_PRO = true` (el "Color libre" no aparece para nadie) y `PLAN_EXPORTAR_SOLO_PRO = false` (el CSV se descarga para todos).
- **Edge Function `crear-negocio`:** cambiada para recibir el WhatsApp del dueño y llamar a `fijar_telefono_dueno` después de `alta_negocio` (si el número no es válido, el negocio se crea igual y se avisa). **NO está desplegada**: se despliega al mezclar a main con `npx supabase functions deploy crear-negocio --project-ref bofxwhdaomnhdagptmmr`. Mientras tanto, el número que se escriba al crear un negocio se ignora.
- **Vista previa de la tarjeta (Fase D):** en Personalización es la tarjeta REAL del cliente (`tarjetaClienteHTML`) con un cliente de ejemplo, dibujada a 390 px (`ANCHO_TELEFONO`), escalada con `escalarVista` y un ResizeObserver, e inerte. Cambia en vivo con color, logo (el recién elegido va como URL local en `negocio.logoUrlVista`) y mensaje; meta y premio, al guardar el programa.
- **Ayudas de primera vez y bienvenida de 3 pasos:** se guardan en localStorage por usuario (`sello_ayudas_vistas:<user_id>`, `sello_onboarding:<user_id>`, ver `clavePorUsuario`); cerrar sesión NO las borra. Cada ayuda cuenta como vista en cuanto aparece, y la bienvenida en cuanto se abre (antes solo al tocar "Entendido" o terminar, y por eso volvían a salir tras salir y entrar). Son por celular: en otro teléfono vuelven a salir una vez.
- **Fase 6E** (`supabase/fase-6e-slug.sql`, aplicado; pruebas en `supabase/fase-6e-pruebas.sql`): `negocios.slug` (único, `^[a-z0-9]+(-[a-z0-9]+)*$`, máx. 40). Se rellenó del nombre (minúsculas, sin acentos, guiones; repetidos con -2, -3). Un trigger BEFORE INSERT lo genera si viene vacío (no se tocó `alta_negocio` ni la Edge Function) y NO cambia si después cambia el nombre. authenticated lo puede leer pero nadie lo escribe directo. `public_get_programa(p_slug)` (anon y authenticated) devuelve solo `{nombre, logo, color, meta, premio}` (meta 10 si está vacía); null si no existe o está desactivado.
- **Página pública del programa `/#/n/<slug>`** (`paginaPrograma` en `src/pages.js`, ruta `programa` en `router.js`): la comparte el negocio para invitar a sus clientes. Una pantalla sin scroll en 390×844, sin QR: logo en círculo blanco de 112 px (o iniciales, máx. 2), nombre, "Programa de lealtad", número de la meta a 130 px con "visitas", "= premio" (sin premio, solo la meta), tarjeta de ejemplo "2 de N" (casillas si N ≤ 8; si no, barra al 25 %), chips "1 · Pide tu código / 2 · Escanea / 3 · Suma" y pie "Gratis · Sin descargar nada" / "Hecho con Sello" con "Aviso de privacidad" (abre el aviso del cliente que ya existía). Fondo del color del negocio (texto #17201E si es claro); en computadora, tarjeta de 420 px sobre #F2F4F3. Títulos en Bricolage Grotesque (`public/fonts/bricolage-grotesque.woff2`, latino, 700–800, en el service worker). Slug inexistente o negocio desactivado: "No encontramos este negocio". El componente es `programaPublicoHTML`: lo usan la página y la miniatura del panel.
- **La ruta vieja `#/landing/<id>` se eliminó** (página y código). `public_get_landing` (fase 6D) sigue en la base, pero la app ya no la usa.
- **Sin enlaces a `/#/n/<slug>` en la app:** la tarjeta "Tu página del programa" de Personalización se quitó (miniatura, link y botones). La ruta pública sigue igual; el negocio comparte el link a mano. Exportar quedó solo con el CSV.
- **Vista previa de los links:** meta tags generales en `index.html` (título "Programa de lealtad", descripción "Junta visitas y gana premios. Hecho con Sello.") con `public/og-sello.png` (1200×630, se genera con `node generar-og.mjs`). `og:image` apunta a `https://lealtad-app.vercel.app/og-sello.png`: cambiarlo si el dominio de producción es otro. La vista previa por negocio queda para después (las rutas con # no la permiten).
- **Fluidez:** el Resumen pinta en cuanto llegan `resumen_inicio` y `resumen_periodo` (mes y semana); las demás tarjetas (cerca del premio, inactivos, actividad, logros, gráfica) aparecen cada una al llegar, en "ranuras" `dn-r-*` (`ranuraResumenHTML`), y sus botones se atienden con un solo listener delegado. Lo de la pestaña Equipo (`resumen_meseros`, Visitas recientes) se pide solo al abrirla; `equipo_negocio` es una sola petición compartida (`pedirEquipo`, 30 s). Logros reusa lo que ya trajo el Resumen. Mes/Semana y cambiar de pestaña no vuelven a pedir nada. La vista previa de la tarjeta cambia el color solo con variables CSS y redibuja el mensaje con 150 ms de retraso. Imagen de logros, confeti y Compartir viven en `src/logros-media.js` (se carga al abrir una celebración) y `qrcode` se carga al abrir el Cajero. Cada pantalla registra su limpieza con `alSalirDePantalla` y `main.js` llama `salirDePantalla()` en cada cambio de ruta; el revisor de ayudas se apaga cuando ya no queda ninguna.
- **Service worker:** `sello-v30` (`public/sw.js`). Solo precachea `/` e `/index.html`; lo demás se guarda al usarse. Subirlo en cada cambio importante.

## Pendiente de decidir

- Negocio piloto (cafetería o barbería; Quinta Juanes no sirve) y cómo cobra hoy (nota a mano, caja o terminal portátil).
- Medir en el piloto: segundos por cobro con QR y cuántos clientes no logran escanear. Ajustar con datos.

---

# Futuro y actualizaciones (NO construir en el MVP)

Orden sugerido; el orden real lo decide qué frene más las ventas.

## 1. Mensajes de WhatsApp

- Un solo sentido, sin bot: las respuestas las atiende el negocio desde su propio WhatsApp.
- Mensajes: "meta alcanzada", 21 días sin visita (el contador se reinicia desde la última visita; el incentivo lo configura cada negocio; es lo que más demuestra valor al dueño) y cumpleaños (al agregarlo, pedir la fecha dentro de la tarjeta del cliente, nunca al registrarse).
- Se llama a WhatsApp SIEMPRE desde el servidor (Edge Functions), nunca desde el cliente.
- Requisitos: consentimiento explícito, manera de dejar de recibir mensajes y aviso de privacidad.
- **Verificación del número (obligatoria antes de enviar):** si alguien escribe un número ajeno, el sistema le mandaría promociones a quien nunca aceptó, lo que genera bloqueos y reportes, baja la calidad de la cuenta de WhatsApp (y sus límites de envío) y es un problema de datos personales. Regla: se puede sumar con un número sin verificar, pero los mensajes SOLO se envían a números verificados.
- Cómo se verifica: en la tarjeta del cliente un botón "Recibe tu premio por WhatsApp" abre un chat con el número del negocio y un mensaje prellenado con un código. Al recibir ese mensaje entrante (webhook), el servidor confirma que el número es real y que su dueño aceptó. Variante a probar: pedirlo desde el registro en vez de después del primer punto.
- A los clientes que ya existían se les pide consentimiento y verificación con un toque la siguiente vez que abran su tarjeta.
- Cobro: por mensaje enviado (alrededor de 4-5 pesos; el costo de Meta para marketing en México bajó en 2025-2026 y una fuente de terceros lo ubica en ~0.04 USD, así que VERIFICAR la tarifa oficial vigente de Meta, que ya publica en pesos, antes de fijar el precio). Sugerido: saldo prepago que el negocio recarga, para no fiar mensajes.
- **"Dejaron de venir" se vuelve accionable con esta fase.** Hoy es una tarjeta solo informativa (gris azulada) en el Resumen. Al llegar WhatsApp, pasar a `abrirListaClientes` la acción por fila para mandarle a cada cliente el mensaje de 21 días.

## 2. QR en el ticket (solo para negocios con caja integrable)

Reemplaza el botón "Cobré una cuenta" del mesero; todo lo demás (reclamar, confirmación de un toque, registro, canje con dos llaves, antifraude) se queda igual.

- Cuando la caja cierra una cuenta, le pide un código a Sello (endpoint en Edge Function, autenticado con una llave de API por negocio) y lo imprime como QR en el ticket.
- Cada petición lleva el id del ticket para que no se generen dos códigos para la misma cuenta (idempotencia).
- Mismo código aleatorio, largo y de un solo uso; el reclamo sigue siendo atómico en el servidor.
- La vigencia del código del ticket es mayor que la del QR del mesero y es configurable por negocio.
- Ventaja principal: el mesero ya no puede inventar códigos sin venta, porque el código sale de la caja.
- Riesgo que se queda: escanear tickets que el cliente deja tirados. Se cubre con el límite de 1 visita por número al día y los números del personal excluidos.
- Permite dar puntos según el monto de la cuenta (el endpoint puede recibir el total).
- Los negocios sin integración siguen con el flujo del mesero en la PWA.

## 3. Niveles de precio, plan Pro y más

- Gratis (QR y puntos), pago por mensaje, y Pro con más estadísticas.
- Pie "Powered by Sello" en la página del cliente (estilo Calendly), removible o personalizable en Pro.
- "Modo mostrador": la misma PWA en una tablet o celular que el negocio ya tenga, para que el cliente teclee su número en el mostrador (con los mismos límites antifraude). No comprar tablets.

## Personalización de la tarjeta (Fase 4, en el panel del dueño)
- Opciones elegidas de una lista, nunca campos libres, con vista previa en vivo de la tarjeta.
- Nombre y logo (subida de imagen), color de una paleta de ~8 colores con buen contraste (color libre solo si pasa comprobación de contraste), ícono del sello (palomita, taza de café, tijeras, taco, estrella, corazón), animación del sello (llenado suave, pop, sin animación; siempre respeta "reducir movimiento"), premio y meta con plantillas, mensaje de agradecimiento (máx. ~40 caracteres).
- Se guardan con una función RPC que valida cada valor contra la lista permitida (no con actualizaciones directas a la tabla).
- **La tarjeta lleva la identidad del negocio, no la de Sello:** logo, nombre, color y mensaje de agradecimiento del negocio. Arriba, el logo de Sello pequeño; abajo, "Hecho con Sello" discreto. Ese pie se puede quitar en Pro (ver sección 3).

## Compartir en redes al ganar el premio (después del piloto)
- Estilo Duolingo: al ganar el premio, el cliente puede compartir una imagen en sus redes.
- La imagen lleva al frente el logo y el nombre del negocio; la marca Sello va pequeña y discreta.
- Del cliente solo aparece su primer nombre (nunca teléfono ni otros datos).
- Se construye después del piloto, con datos de si los clientes de verdad comparten.

## Panel de administración de Sello (después de la Fase 4, antes del segundo negocio)
- Es para el dueño de Sello. Se identifica con una tabla aparte `admins` (user_id), comprobada en el servidor mediante funciones SECURITY DEFINER. Nunca con una contraseña en el código.
- Ver todos los negocios con sus números (clientes, visitas, códigos) y estadísticas globales. Solo conteos: el admin nunca ve teléfonos ni nombres de clientes.
- Dar de baja o reactivar un negocio con negocios.activo (ya bloquea login, creación de códigos y reclamos).
- Dar de alta un negocio con su cuenta de dueño mediante una Edge Function (la llave service_role nunca va en el navegador).

## Datos de clientes
- Los datos de clientes (teléfono en E.164, nombre, historial de visitas) nunca se borran por limpieza técnica.
- Solo el dueño de cada negocio ve los datos de sus clientes; el administrador de Sello ve solo conteos.
- El correo se pedirá de forma opcional dentro de la tarjeta, nunca al registrarse.
- Usar el teléfono o el correo para promociones requiere consentimiento y verificación.

## 4. App de Sello (ÚLTIMO paso; va DESPUÉS de WhatsApp)

La app deja de ser "la tarjeta de un negocio" y se vuelve la cartera de lealtad del cliente en toda la ciudad.
### Qué hace
- **Mis negocios:** el cliente ve todos los negocios donde está registrado, con su progreso en cada uno (por ejemplo "Café X 6/10") y un aviso cuando ya tiene un premio por canjear. Todo ligado a su número verificado.
- **Mapa de negocios cercanos que usan Sello:** con una API de mapas. Muestra los negocios cercanos y destaca los que están a punto de darle un premio ("te falta 1 visita") para que vaya por sus puntos. Opciones de mapas a evaluar según costo: Google Maps (cuota gratuita mensual limitada), Mapbox (cuota gratuita mayor) o mapas basados en OpenStreetMap con MapLibre (gratuito).
- Un negocio aparece en el mapa solo si el dueño lo activa (opt-in) y completa dirección, horario y premio.
- La ubicación del cliente se pide con permiso, se usa solo mientras ve el mapa y no se guarda.
- Canje, antifraude y reglas de visitas son las mismas del MVP.

### Reglas técnicas
- El flujo por QR y por número debe seguir funcionando para quien no instale la app. La app es una capa opcional; nada deja de funcionar sin ella.
- Preferir empaquetar la misma PWA (por ejemplo con Capacitor) antes que reescribir. Cuentas necesarias: Apple Developer (99 USD al año) y Google Play (25 USD, pago único). Compilar para iPhone requiere una Mac o un servicio de compilación en la nube.
- La verificación del número es obligatoria (la misma de la fase de WhatsApp), para ligar la cuenta y las notificaciones push a un número real.

### Diseño: estilo Apple, muy bonito, intuitivo y nada confuso
- Mucho espacio en blanco, títulos grandes y UNA acción principal por pantalla.
- Tipografía del sistema (San Francisco en iPhone), esquinas redondeadas consistentes e íconos simples.
- Máximo 3 pestañas: "Mis puntos", "Cerca de mí" y "Perfil". Nada de menús profundos.
- Tarjetas de progreso visuales (sellos o círculo que se llena con una animación suave).
- Cuidar cada detalle: estados vacíos amables, esqueletos de carga en lugar de pantallas en blanco, animaciones sutiles, retroalimentación háptica en acciones clave, modo oscuro y accesibilidad (tamaño de texto dinámico, buen contraste).
- Textos cortos y claros. Si algo necesita explicación, está mal diseñado.

### Cuándo empezarla (señales, no fecha)
Reglas prácticas a ajustar con datos reales del piloto:
1. WhatsApp ya funcionando y generando ingresos recurrentes.
2. Entre 15 y 25 negocios activos concentrados en la misma ciudad, para que el mapa no se vea vacío.
3. Evidencia de demanda: una parte importante de los clientes ya está registrada en 2 o más negocios de Sello, o clientes y dueños la piden.
Medir desde el MVP el porcentaje de clientes registrados en más de un negocio.

---

## Cómo trabajar en este repo

1. Primero haz un diagnóstico: lee todo el código y dime qué está hecho, qué falta y qué está roto. No reescribas nada sin preguntarme.
2. Explica el porqué de cada decisión técnica y da los pasos con contexto.
3. Cuando cambies un archivo, entrégalo completo, no solo fragmentos.
4. Responde en español.
