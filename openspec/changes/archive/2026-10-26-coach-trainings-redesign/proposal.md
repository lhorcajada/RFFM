## Why

Las tres pestañas de Entrenamientos del Coach (Planificación, Ejercicios, Sesiones) usan pestañas MUI
genéricas, acordeones anidados y filas planas. Cuesta ver de un vistazo el estado de la temporada
(semanas sin sesiones, semana actual), los controles de las tarjetas son pequeños para uso táctil y las
sesiones se leen como una lista de texto. El rediseño de referencia está en `.design/coach-trainings`.

## What Changes

- **Solo frontend (`Front/`)**, página `Trainings`; sin cambios de API, backend ni de datos.
  - **Pestañas**: control segmentado con iconos, ≥ 44 px de alto, que se reparte en filas si no cabe.
  - **Planificación**: resumen superior (macrociclos, sesiones planificadas, semanas sin sesiones) y
    microciclos como tarjetas en rejilla responsive con estado (Semana actual / N sesiones / Sin
    sesiones), objetivo semanal y sesiones con bloque de fecha.
  - **Ejercicios**: barra de filtros con el recuento de ejercicios y rejilla de cromos; acciones de la
    tarjeta con área táctil ≥ 44 px.
  - **Sesiones**: tarjetas con bloque de fecha, hora, lugar, nº de ejercicios y partido asociado; barra
    de selección que resalta y muestra el recuento al seleccionar; acciones ≥ 44 px.
- Se mantiene: selects de Tipo/Subtipo/Temporada (mismos roles y etiquetas), nombres de pestaña,
  acciones del encabezado, diálogos de borrado, edición del plan, impresión y navegación existentes.
- **Versión**: web minor (1.75.0 → 1.76.0).

## Capabilities

### New Capabilities
- `coach-trainings-redesign`: pestañas segmentadas, resumen y tarjetas de la planificación, recuento y
  táctil en ejercicios, tarjetas y selección en sesiones.

## Impact

- `Front/src/apps/coach/pages/trainings/Trainings.tsx` + `Trainings.module.css`.
- `season-plan/SeasonPlanView.tsx` + `.module.css` (resumen y tarjetas).
- `components/SessionsList.tsx` + `.module.css`, `components/ExerciseCromo.module.css`.
- Tests: `season-plan/__tests__/SeasonPlanView.test.tsx`, `components/__tests__/SessionsList.test.tsx`,
  `__tests__/Trainings.*.test.tsx`.
- `Front/package.json` (versión).
- **Fuera de alcance**: editor de planificación, tablero de contenido, páginas nueva sesión/ejercicio,
  impresión, backend, contadores en las pestañas (los datos de las otras pestañas no están cargados).
