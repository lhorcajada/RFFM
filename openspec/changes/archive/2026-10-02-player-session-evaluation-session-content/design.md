## Context

- `TrainingSessionDetail` (`GET /api/trainings/sessions/{id}`) trae:
  - datos de la sesión: `startTime`, `endTime`, `location`, `sportEventName` y `objetivoGeneral`;
  - `blocks[]` con `rotacionEntreEjercicios` y `exercises[]` (`exerciseId`, `name`, `objetivo`,
    `durationMinutes`, `urlImage`, `tipo`);
  - `targets[]`.
- El ejercicio completo (`Exercise`, `trainingService.getExerciseById`) trae `descripcion`, `logistica`,
  `porteros`, `nivelesColumnas` y `niveles`, `modelRelations[]` (`subprincipioId`, número, título, `isFoco`,
  `habilidadesImprescindibles`, `items[]` con sub-subprincipios), `urlImage` y `boardStateJson`.
- Se reutilizan:
  - `TacticalBoardSnapshotPreview` (`components/`, props `snapshot` y `teamId`; carga la plantilla) con
    `tryParseBoardSnapshot` y `hasBoardObjects`;
  - `mediaUrl` (`pages/trainings/exercisePrint.ts`);
  - `TIPO_LABELS` (`pages/trainings/exerciseTypeLabels.ts`).
- `SessionEvaluationDialog` usa `useSessionDetail` y pasa el detalle a `SessionEvaluationForm`, que pinta
  `SessionContent` y los `RatingBlock`.

## Decisions

### D1 · `useSessionExercises(detail)` (`pages/player/hooks/`)

`{ exercisesById: Map<string, Exercise>, loading }`.
- Pide `getExerciseById` para los `exerciseId` distintos del detalle (`Promise.all`) y descarta los
  `null`.
- Si falla, devuelve un mapa vacío: las tarjetas se ven con los datos básicos del bloque.
- Sin detalle, no pide nada.

### D2 · `habilidadesBySubprincipio(exercises)` (`pages/player/utils/sessionHabilidades.ts`)

`Map<subprincipioId, string[]>` con la unión, sin repetir y en orden de aparición, de las
`habilidadesImprescindibles` de las `modelRelations` de los ejercicios para cada `subprincipioId`.

### D3 · `SessionExerciseCard` (`components/tracking/`, + `.module.css`)

Props: `blockExercise: SessionBlockExercise`, `exercise?: Exercise` y `teamId`.
- Arriba, la imagen (`<img>` con `mediaUrl`) o, si no hay imagen y la pizarra tiene objetos,
  `TacticalBoardSnapshotPreview` dentro de un contenedor de alto fijo (como `ExerciseCromo`).
- Nombre, chip de tipo (`TIPO_LABELS`), duración y objetivo, con los datos del ejercicio completo o, en
  su defecto, los del bloque.
- Botón «Ver detalle» / «Ocultar detalle» (`aria-expanded`), que despliega:
  - descripción, logística y porteros, si los hay;
  - niveles en **lista**: un elemento por nivel, «Nivel N» y `columna: valor`;
  - «Relación con el modelo»: por relación, `número · título` (Foco o Integrado), sus sub-subprincipios
    y chips de habilidades imprescindibles.
  
  Sin ejercicio completo no se muestra el botón.

### D4 · `SessionContent`

- Nuevas props: `exercisesById` y `teamId`.
- Cabecera: «hora inicio – hora fin · lugar · evento», con lo que haya.
- Por bloque: nombre, rotación entre ejercicios (si la hay) y una `SessionExerciseCard` por ejercicio.
- Se mantienen el objetivo general y el mensaje «La sesión no tiene ejercicios registrados».

### D5 · Formulario y diálogo

- `SessionEvaluationDialog` usa `useSessionExercises(detail)` y pasa `exercisesById`, `exercisesLoading`
  y `teamId` al formulario.
- `SessionEvaluationForm`:
  - calcula `habilidadesBySubprincipio([...exercisesById.values()])`;
  - en cada `RatingBlock` de subprincipio, bajo sus sub-subprincipios, muestra «Habilidades trabajadas»
    con chips. Si no hay ninguna, no muestra nada;
  - pasa `exercisesById` y `teamId` a `SessionContent`.

## Tests

- `useSessionExercises`: pide cada ejercicio una vez, descarta los `null` y, si falla, devuelve un mapa
  vacío.
- `habilidadesBySubprincipio`: unión sin duplicados y por subprincipio.
- `SessionExerciseCard`:
  - imagen;
  - pizarra (con el preview mockeado);
  - tipo y duración;
  - «Ver detalle» con descripción, niveles en lista y relación con el modelo;
  - sin ejercicio completo, sin botón.
- `SessionContent`: cabecera de la sesión y rotación del bloque.
- `SessionEvaluationForm`: «Habilidades trabajadas» en el bloque del subprincipio correspondiente.
- `SessionEvaluationDialog`: pide los ejercicios del detalle.
