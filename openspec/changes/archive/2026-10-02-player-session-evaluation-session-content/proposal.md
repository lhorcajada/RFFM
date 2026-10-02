## Why

Entrega R3 del rediseño «seguimiento por sesión». El entrenador pidió ver en el diálogo de valoración
**todo** lo de la sesión, incluidos los ejercicios con su dibujo, y no tener que elegir las habilidades,
porque **ya están en la sesión**. Hoy el diálogo solo muestra nombre, objetivo y duración de cada
ejercicio, y nada de habilidades.

## What Changes

Todo en el **frontend (Coach, `Front/`)**; no cambia el backend:

- **Ejercicios completos.** Cada ejercicio de la sesión se muestra como tarjeta:
  - imagen o, si no tiene, el **dibujo de la pizarra táctica**;
  - nombre, tipo, duración y objetivo;
  - un «Ver detalle» que despliega descripción, logística, niveles (en lista, sin tablas) y la relación
    con el modelo de juego (subprincipios, sub-subprincipios y habilidades imprescindibles).
  
  Los datos completos se piden con `getExerciseById`, como en «Imprimir sesión».
- **Cabecera de la sesión**: hora, lugar y evento del calendario. En cada bloque, la rotación entre
  ejercicios.
- **Habilidades de la sesión**: en cada bloque de subprincipio del formulario, «Habilidades trabajadas»
  con las habilidades imprescindibles de los ejercicios de la sesión relacionados con ese subprincipio.
  No se eligen ni se guardan; solo se muestran.
- **Versión**: web minor.

## Capabilities

### New Capabilities
- `player-session-evaluation-session-content`: el diálogo de seguimiento muestra el contenido completo de
  la sesión y las habilidades trabajadas por subprincipio.

## Impact

- `Front/src/apps/coach/pages/player/`:
  - `hooks/useSessionExercises.ts` y `utils/sessionHabilidades.ts` (nuevos);
  - `components/tracking/SessionExerciseCard.tsx` (nuevo);
  - cambios en `SessionContent`, `SessionEvaluationForm` y `SessionEvaluationDialog`.
- Se reutilizan `TacticalBoardSnapshotPreview`, `mediaUrl` (`exercisePrint.ts`) y `TIPO_LABELS`.
- **Fuera de alcance**:
  - modo «Ver» (R3b);
  - comentarios evaluables (R4);
  - arreglar «Imprimir sesión» (backlog);
  - las habilidades del modelo de juego por sub-subprincipio (el detalle de sesión no las trae).
