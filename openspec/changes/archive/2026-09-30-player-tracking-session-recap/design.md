## Context

- `trainingService.getSessions(teamId)` → `TrainingSession[]` con:
  - `date` (nullable);
  - `sportEventId` (nullable), el evento del calendario donde se registra la asistencia;
  - `targets: SessionTargetDetail[]`: `subprincipioId`, `subprincipioTitulo`, `numero` y `rol` del
    sub-subprincipio, `zonaLabel`, `principioTitulo` y `gameMomentName`.
- `trainingService.getSessionById(id)` → `TrainingSessionDetail`, que además trae `objetivoGeneral` y
  `blocks[].exercises[]` (`exerciseName`, `exerciseObjetivo`, `exerciseDurationMinutes`).
- `convocationService.getConvocations(eventId)` → `ConvocationItem[]` con `player.id` (teamPlayerId) y
  `assistanceTypeId`. Los tipos de asistencia son: 1 Asiste, 2 No asiste con excusa, 3 No asiste sin
  excusa y 4 Llega tarde (`AssistanceType.cs`).
- La API de observaciones (1a) crea una observación por llamada `POST`.
- `ObservationForm` (1b) sigue siendo el formulario «Sin sesión».

## Decisions

### D1 · Hooks (`pages/player/hooks/`)

- `useRecentSessions(teamId, days = 30)` → `{ sessions, loading }`.
  - Incluye las sesiones con `date` entre hoy − 30 días y hoy, de la más reciente a la más antigua.
  - Si hay error, devuelve `[]`.
- `useSessionDetail(sessionId | null)` → `{ detail, loading }`.
- `usePlayerSessionAttendance(sportEventId | null | undefined, teamPlayerId)` → `{ attendance, loading }`,
  con `attendance` de tipo
  `"no-event" | "unknown" | "attended" | "late" | "absent-excused" | "absent-unexcused"`:
  - sin `sportEventId` → `no-event`, sin llamar a la API;
  - el jugador no aparece en las convocatorias, su `assistanceTypeId` es nulo o la carga falla →
    `unknown`;
  - asistencia 1 → `attended`, 4 → `late`, 2 → `absent-excused`, 3 → `absent-unexcused`.

### D2 · `AssessmentButtons.tsx` (+ `.module.css`)

Se extrae del `ObservationForm` de la 1b el `ToggleButtonGroup` de tres botones, con `aria-label` por
botón. Props: `value`, `onChange` y `ariaLabel`. El `ObservationForm` pasa a usarlo sin cambiar su
comportamiento: sus tests siguen en verde **sin tocarlos**.

### D3 · `SessionContent.tsx` (+ `.module.css`)

Recibe `detail: TrainingSessionDetail | null` y `loading`. Muestra una sección «Qué se hizo» con:
- el objetivo general;
- los ejercicios **a la vista, sin plegar**, agrupados por bloque (ordenados por `order`, y dentro de
  cada bloque por `position`), con nombre, objetivo y duración.

Mientras carga muestra un `CircularProgress`. Si la sesión no tiene ejercicios: «La sesión no tiene
ejercicios registrados».

### D4 · `SessionObservationForm.tsx` (+ `.module.css`)

Props: `session`, `teamPlayerId`, `saving` y `onSubmit(requests: CreatePlayerObservationRequest[])`,
donde `onSubmit` devuelve los índices que fallaron.

1. Cabecera: `dd/MM/yyyy · {name}`.
2. Aviso de asistencia (`usePlayerSessionAttendance(session.sportEventId, teamPlayerId)`):
   - `absent-*` → `Alert` warning: «El jugador no asistió a este entrenamiento (con excusa / sin
     excusa). Si valoras algún subprincipio, explica en el comentario por qué.»
   - `late` → `Alert` info: «El jugador llegó tarde a este entrenamiento.»
   - `unknown` → `Alert` info: «No hay asistencia registrada para este jugador en esta sesión.»
   - `no-event` → `Alert` info: «La sesión no está vinculada a un evento del calendario; no se puede
     comprobar la asistencia.»
   - `attended` → sin aviso.
3. `SessionContent` (D3).
4. Un bloque por subprincipio de la sesión: se agrupan los `targets` por `subprincipioId` en orden de
   aparición. Cada bloque tiene:
   - cabecera `{gameMomentName} · {principioTitulo}`;
   - título `subprincipioTitulo`;
   - líneas `{numero} {rol}[ · {zonaLabel}]`;
   - `AssessmentButtons` con `ariaLabel="Valoración de {subprincipioTitulo}"`;
   - comentario «Comentario sobre {subprincipioTitulo}» (máximo 500 caracteres).
   
   Si el jugador no asistió y el bloque está valorado sin comentario, el campo se marca en error:
   «Indica por qué: no asistió al entrenamiento».
5. «Guardar»:
   - se deshabilita si no hay ningún bloque valorado, si falta un comentario obligatorio o mientras
     guarda;
   - crea una request por cada bloque valorado:
     `{ date: session.date.slice(0,10), subprincipioId, assessment, comment }`;
   - los bloques que se guardaron se limpian y los que fallaron conservan lo escrito.
6. Sesión sin targets: «Esta sesión no tiene subprincipios del modelo de juego asociados. Asócialos en
   la sesión o registra la observación sin sesión.» No se muestran bloques de valoración.

### D5 · `PlayerTrackingPanel`

- Usa `useRecentSessions(teamId)`. Si hay sesiones, muestra un `TextField select` «Sesión» con «Sin
  sesión» (valor por defecto) y las opciones `dd/MM · {name}`.
- Con sesión → `SessionObservationForm`. Sin sesión → `ObservationForm` (1b).
- `onSubmit` de la sesión crea las observaciones **en secuencia** con `create` de
  `usePlayerObservations` y recoge los índices que fallan. Avisos por `rffm.show_snackbar`:
  - todo bien: «N observaciones guardadas» («Observación guardada» si es una);
  - algún fallo: `error` con el `detail` del primer fallo o «No se pudieron guardar algunas
    observaciones».

## Risks / Trade-offs

- La sesión **no se guarda** con la observación hasta la 1d. La fecha sí es la de la sesión.
- Si alguna creación falla a mitad de un guardado, las que ya se crearon quedan guardadas (no hay
  transacción). El formulario solo conserva las fallidas para reintentarlas, así que no se duplican.
- La asistencia se consulta con el endpoint de convocatorias, que exige la feature `Convocations`
  (`Read`). Si el usuario no la tiene, el aviso cae en `unknown` y el formulario funciona igual.
