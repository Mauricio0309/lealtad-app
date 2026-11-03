# Fase 4: panel del dueño

Estado: **en curso**. No pasar a lo siguiente sin OK del dueño del proyecto.

Objetivo: el dueño abre el panel y en 3 segundos entiende si Sello le sirve. Una pantalla (máximo 1.5 de alto en celular), números grandes, textos sencillos, sin jerga y sin gráficas.

## Avance

| Paso | Estado | Archivo |
|---|---|---|
| 4A Base de datos y funciones | ⏳ Escrito, falta revisar y ejecutar | `supabase/fase-4.sql` |
| 4B Panel, programa y bienvenida | ⏳ Escrito, se prueba después de 4A | `src/pages.js` |

## Qué ve el dueño (en este orden)

1. **Grande:** "Tus clientes volvieron N veces esta semana · ≈ $X en ventas (estimado)". Sin ticket promedio: "N visitas de clientes que regresaron" y una invitación discreta a decir cuánto gasta un cliente.
2. Clientes registrados · Visitas esta semana (▲▼ contra la anterior) · "Regresaron: N de cada 10".
3. "Dejaron de venir (más de 21 días): N" → al tocar, la lista (primer nombre, ···4821, última visita, visitas).
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
