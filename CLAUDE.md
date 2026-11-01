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
