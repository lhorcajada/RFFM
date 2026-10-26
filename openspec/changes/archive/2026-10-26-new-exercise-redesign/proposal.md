## Why

La pantalla «Nuevo ejercicio» del Coach apila todos los campos en una sola rejilla de dos columnas con
selects MUI, una barra de herramientas inferior y un editor de Niveles que ocupa mucho espacio. Cuesta
escanear el formulario y los controles son pequeños para uso táctil. El rediseño de referencia está en
`.design/new-exercise`.

## What Changes

- **Solo frontend (`Front/`)**, página `NewExercisePage`; sin cambios de API ni backend.
  - **Cabecera**: título del ejercicio editable en la barra superior junto a Cancelar y Guardar.
  - **Herramientas de pizarra**: carril vertical a la izquierda del campo (Chapas, Espacios, Material,
    Líneas, Texto) en lugar de la barra inferior.
  - **Panel de datos**: tarjetas por sección (Clasificación, Objetivos, Modelo de juego, Organización,
    Imagen / vídeo); «Tipo» como selector segmentado de tres botones de ≥ 44 px.
  - **Se quitan de la UI** el editor de **Niveles** y el campo **Dibujo (opcional)**. Los datos siguen
    en el modelo y en la API: se conservan al editar y el ejercicio nuevo se crea con los niveles por
    defecto.
- Se mantiene: bloqueo en móvil, tiras contextuales (chapas, espacios, material, líneas, texto), campo
  táctico, relaciones con el modelo de juego, subida de medio, validaciones y guardado.
- **Versión**: web minor (1.76.0 → 1.77.0).

## Capabilities

### New Capabilities
- `new-exercise-redesign`: cabecera con título, carril de herramientas, panel por tarjetas, tipo
  segmentado y retirada de Niveles/Dibujo de la UI.

## Impact

- `Front/src/apps/coach/pages/trainings/new/NewExercisePage.tsx` + `.module.css`.
- `new/components/ExerciseFormPanel.tsx`, `new/hooks/useExerciseForm.ts` (niveles por defecto al cargar).
- Tests: `components/__tests__/ExerciseFormPanel.test.tsx`, `__tests__/NewExercisePage.test.tsx`.
- `Front/package.json` (versión).
- **Fuera de alcance**: formulario móvil (sigue bloqueado), backend y contrato de API, eliminación de
  `NivelesEditor.tsx` (queda sin uso en la página), cambios en el campo táctico.
