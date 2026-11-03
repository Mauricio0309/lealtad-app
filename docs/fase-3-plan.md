# Fase 3: canje del premio con dos llaves

Estado: **en curso**. No pasar a la Fase 4 sin OK del dueño del proyecto.

Objetivo: el cliente canjea su premio sin que nadie pueda hacerlo solo. El cliente genera un código de 4 dígitos en su celular; el mesero lo escribe, ve premio, nombre y últimos 4 dígitos, y confirma la entrega viendo al cliente. Ni el mesero canjea sin el celular del cliente, ni el cliente sin el mesero.

## Avance

| Paso | Estado | Archivo |
|---|---|---|
| 3A Base de datos y funciones | ⏳ Escrito, falta revisar y ejecutar | `supabase/fase-3-canje.sql` |
| 3B Pantallas del cliente y del mesero | ⏳ Escrito, se prueba después de 3A | `src/pages.js` |

## Reglas

- "Canjear mi premio" solo aparece si `puntos_actuales >= meta`.
- Código de 4 dígitos, de un solo uso, caduca a los 5 minutos. No se repite entre canjes pendientes del mismo negocio.
- Si el cliente vuelve a tocar "Canjear" con un canje pendiente vigente, ve el mismo código (no se crea otro).
- Al crear el canje se copian el texto del premio y los puntos a descontar (la meta). Si el dueño cambia el programa, no afecta un canje en curso.
- Confirmar es atómico en el servidor: bloquea el canje y al cliente, revisa que siga pendiente y vigente y que tenga los puntos, descuenta y guarda quién confirmó y cuándo.
- Se descuentan los puntos de la meta, no todos: si tenía 11/10, queda en 1/10.
- Antifraude: 5 códigos incorrectos seguidos bloquean al mesero 5 minutos. El mesero no puede leer la tabla de canjes (vería los códigos pendientes sin el celular del cliente); el dueño sí la lee, para su panel en la Fase 4.
- El cliente usa su token de dispositivo (sin sesión); el mesero y el dueño usan su sesión.

## Funciones RPC

| Función | Quién | Qué hace |
|---|---|---|
| `crear_canje(token)` | cliente (anon) | Crea el canje o devuelve el pendiente vigente |
| `estado_canje(token, código)` | cliente (anon) | Pendiente, entregado, cancelado o caducado (se consulta cada ~3 s) |
| `cancelar_canje(token, código)` | cliente (anon) | El cliente se arrepiente |
| `consultar_canje(código)` | mesero o dueño | Premio, nombre y últimos 4; cuenta intentos fallidos |
| `confirmar_canje(id)` | mesero o dueño | Entrega atómica y descuento de puntos |

## Pantallas

- **Cliente (tarjeta):** botón grande "Canjear mi premio" → código en grande, cuenta regresiva de 5:00, "Muéstraselo al mesero" y "Cancelar" → "¡Disfruta tu premio!" con la tarjeta ya actualizada.
- **Mesero:** botón "Canjear premio" bajo "Cobré una cuenta" → teclado de 4 dígitos → premio, nombre y ···4821 en grande, "Confírmalo solo si ves al cliente" y "Confirmar entrega" → pantalla de éxito.

## Pruebas

- SQL: bloques con `begin` / `rollback` al final de `supabase/fase-3-canje.sql`.
- App: cliente con la meta completa en un celular y mesero en otro; canjear, cancelar, dejar caducar, código equivocado 5 veces, confirmar dos veces el mismo canje.

## Fuera de esta fase

- Historial de canjes y "premios canjeados" en el panel del dueño (Fase 4; la tabla ya queda lista para leerse).
- Ver el historial de visitas del cliente al canjear.
