## Why

La pantalla «Nueva sesión de entrenamiento» del Coach apila todos los campos en una sola columna con
controles pequeños y bloques poco escaneables. El rediseño de referencia está en
`.design/new-session` (escritorio y móvil).

## What Changes

- **Solo frontend (`Front/`)**, `NewSessionPage` y `SessionBlockEditor`; sin cambios de API ni backend.
  - **Cabecera**: Volver, título de la página y acciones Visualizar / Imprimir PDF / Guardar.
  - **Tarjetas por sección**: «Datos de la sesión» (nombre, ubicación en el plan, objetivo, mapa de campo)
    y «Cuándo y dónde» (fecha, inicio, fin, lugar, evento deportivo), en dos columnas en escritorio y una en móvil.
  - **Resumen**: número de bloques y de ejercicios de la sesión.
  - **Bloques**: insignia numerada, aviso de bloque vacío y controles de ≥ 44 px.
- Se mantiene: arrastrar para reordenar, selector de ejercicios, crear/editar ejercicio con borrador,
  guardado, visualizar e imprimir.
- **Versión**: web minor (1.77.0 → 1.78.0).

## Capabilities

### New Capabilities
- `new-session-redesign`: secciones en tarjetas, resumen y bloques numerados en la sesión de entrenamiento.

## Impact

- `Front/src/apps/coach/pages/trainings/new-session/NewSessionPage.tsx` + `.module.css`.
- `new-session/components/SessionBlockEditor.tsx` + `.module.css`.
- Tests: `__tests__/NewSessionPage.layout.test.tsx`, `components/__tests__/SessionBlockEditor.test.tsx`.
- `Front/package.json` (versión).
- **Fuera de alcance**: minutos por bloque y barra de progreso (requieren la duración de cada ejercicio
  fuera del editor), menú de acciones del bloque en móvil, backend y contrato de API.
