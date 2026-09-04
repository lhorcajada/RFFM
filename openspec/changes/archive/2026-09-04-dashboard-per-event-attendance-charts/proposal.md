## Why

El "Dashboard" del resumen de asistencias (`/coach/attendance/summary?teamId`, pestaña Dashboard) muestra hoy 4 tarjetas (Resumen global / Entrenamientos / Partidos / Otros eventos), cada una con un único porcentaje **acumulado de toda la temporada**. Ese acumulado mezcla la primera jornada con la última y da poca información accionable: un entrenador no puede ver si la asistencia está mejorando o empeorando, ni identificar qué evento concreto tuvo baja asistencia — solo un número plano. Un spike visual (aprobado por el usuario) mostró la alternativa: cada tarjeta de categoría pasa de un número acumulado a un **gráfico de barras evento a evento**, con el % agregado de la categoría como referencia, navegable hacia atrás en el calendario con una ventana de los últimos N eventos (mismo criterio que la tira de "últimos 5" ya usada en la pestaña Partidos).

## What Changes

- **Resumen global**: se mantiene como cifra única agregada (sigue siendo el único caso donde un solo número tiene sentido — no hay "evento a evento" para un total transversal a categorías).
- **Entrenamientos / Partidos / Otros eventos**: cada tarjeta sustituye el bloque `Eventos / Asisten / No asisten` acumulado por un **gráfico de barras** (una barra = un evento finalizado de esa categoría, altura = % de asistencia de ese evento), con:
  - El % agregado de la categoría junto al título, como referencia (ya no como única cifra).
  - Ventana de los últimos 5 eventos + navegación ◀▶ hacia atrás en el calendario de la temporada.
  - Tooltip al pasar el ratón (o tocar, en móvil) con nombre del evento, fecha, convocados/asisten/no asisten y %.
  - Alternativa "Ver como tabla" con los mismos datos en formato accesible (sin depender del color).
- Sin copy explicativo tipo spike ("En vez de un único número...") en la app real — eso era solo para mostrar la propuesta, no debe aparecer en el producto.
- **Bug de datos a evitar**: los entrenamientos ya tuvieron un bug donde el agregado (`nextSummary.training`) se recalculaba con una lógica más rica (ausencias justificadas sin `assistanceTypeId`) distinta de la de partidos/otros, y el total del dashboard no se enteraba (corregido en `fix(front): make dashboard "Resumen global" always match its tiles`). El desglose evento a evento de Entrenamientos debe construirse con esa **misma lógica rica ya corregida**, no con el cálculo más simple de la primera pasada — para no reintroducir una discrepancia entre "lo que ves evento a evento" y "el % agregado de la tarjeta".
- Colores del gráfico validados con el validador de paletas del skill `dataviz` (contraste y daltonismo) sobre la superficie oscura real de la app (`--rffm-card-bg: #1c1c30`): Entrenamientos `#3987e5` (azul), Partidos `#199e70` (verde azulado), Otros `#9085e9` (violeta) — todas las comprobaciones en verde.

## Capabilities

### New Capabilities
- `coach-attendance-dashboard`: estructura y comportamiento de la pestaña "Dashboard" del resumen de asistencias (gráfico evento a evento por categoría, ventana navegable, tooltip, vista tabla).

### Modified Capabilities
(ninguna — el Dashboard no tenía spec de OpenSpec previa)

## Impact

- `Front/src/apps/coach/pages/attendance/components/summary/AttendanceDashboardTab.tsx` (reescritura: Resumen global se mantiene tal cual; las otras 3 tarjetas pasan a usar el nuevo componente de gráfico)
- `Front/src/apps/coach/pages/attendance/components/summary/AttendanceSummaryContent.tsx` (construir, además del `SummaryByType` agregado ya existente, un desglose evento a evento por categoría — reutilizando la lógica de cálculo de asistencia de entrenamientos ya corregida)
- `Front/src/apps/coach/pages/attendance/components/summary/types.ts` (nuevo tipo para el punto de datos evento a evento y para el desglose por categoría)
- Nuevo componente `Front/src/apps/coach/pages/attendance/components/summary/AttendanceEventChart.tsx` (gráfico de barras + paginación + tooltip + tabla, reutilizable por las 3 categorías)
- `Front/src/apps/coach/pages/attendance/AttendanceSummary.module.css` (clases nuevas del gráfico; los colores de categoría ya reservados por Partidos —`matchDorsalJersey`/`matchDorsalJerseyKeeper`— no se reutilizan aquí, son paletas independientes)
- Sin cambios de backend — todos los datos evento a evento ya llegan al frontend hoy (convocatorias por evento), solo hay que dejar de colapsarlos en un único acumulado antes de que lleguen al Dashboard.
