## Context

`Trainings.tsx` renderiza tres pestañas MUI (`Tab` «Planificación», «Ejercicios», «Sesiones») y delega en
`SeasonPlanView`, `ExerciseCromo` y `SessionsList`. Los tests existentes localizan pestañas por rol/nombre,
selects por `combobox` (Tipo, Subtipo, Temporada), microciclos por `data-testid="microciclo-row-<id>"` y
chips por texto exacto («Sin sesiones», «1 sesiones»). La referencia visual es `.design/coach-trainings`.

## Decisions

- **D1 — Restyle sin cambiar contratos.** Se conservan roles, etiquetas, `data-testid`, textos de chips y
  el orden (microciclos más reciente primero). Los tests existentes deben seguir en verde.
- **D2 — Pestañas.** Se mantiene `Tabs`/`Tab` de MUI (accesibilidad y tests); se restilan por CSS Module
  como control segmentado (`min-height: 44px`, `flex-wrap`, indicador oculto, fondo en la pestaña activa).
  Sin contadores en las etiquetas para no cambiar el nombre accesible ni cargar datos de otras pestañas.
- **D3 — Resumen de planificación.** `SeasonPlanSummary` (en `SeasonPlanView.tsx`) calcula desde el plan:
  nº de macrociclos, sesiones totales y microciclos sin sesiones. Se muestra solo con plan cargado.
- **D4 — Tarjetas de microciclo.** `MicrocicloRow` pasa a tarjeta; los microciclos de un mesociclo van en
  rejilla `repeat(auto-fit, minmax(300px, 1fr))`. Estado: «Semana actual» si hoy está entre `startDate` y
  `endDate` (fechas ISO `YYYY-MM-DD`; en tests se fija la fecha con `vi.setSystemTime`), chip «N sesiones»
  o «Sin sesiones» como hasta ahora.
- **D5 — Ejercicios.** Línea de recuento («N ejercicios») junto a los filtros; las acciones de
  `ExerciseCromo` suben a 44 px de área táctil. Los `Select` no cambian.
- **D6 — Sesiones.** `SessionCard` muestra bloque de fecha (día + mes), nombre, hora/lugar, chips y
  acciones de 44 px; la tarjeta seleccionada se resalta. La barra de selección de `Trainings.tsx` muestra
  «N sesiones seleccionadas» y se resalta cuando hay selección.
- **D7 — Estilos.** CSS Modules co-ubicados; colores ya usados (`#4d9de0`, `#a8d4f5`, fondos
  `rgba(255,255,255,.03)`), ámbar `#f0b429` para «Sin sesiones». Sin `style={{}}` ni `styled()`. Sin tablas.
  Responsive mobile-first (~360 px) sin scroll horizontal.

## Risks

- Estilos MUI con `!important` heredados en `SeasonPlanView.module.css`: al retirar reglas, comprobar
  visualmente en escritorio y a ~360 px.
- La fecha de «Semana actual» depende del reloj del navegador; aceptable.
