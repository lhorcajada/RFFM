## Context

- API disponible (1a):
  - `GET /api/teams/{teamId}/players/{teamPlayerId}/observations` → `PlayerObservationDto[]`, la más
    reciente primero;
  - `POST` de la misma ruta, con `{ date: "yyyy-MM-dd", subprincipioId, assessment, comment? }` →
    `201` + DTO;
  - permiso `GameModel` (`Read`/`ReadWrite`) + pertenencia al equipo.
- Modelo de juego en el front:
  - `gameModelService.getByTeamIdAndSeason(teamId, seasonLabel)` → `GameModel | null`, con
    `principles[].subprincipios[]`. El id real de backend está en `apiId`; `id` es una clave local
    numérica.
  - La etiqueta de temporada sale de `seasonService.getActiveSeason()` (`name ?? id`), como en
    `ModelRelationSection.tsx`.
  - Nombre de la Fase: `principle.gameMomentName`.
- Ficha (`PlayerDetail.tsx`):
  - pestañas por índice `activeTab` 0-6;
  - ya usa `usePermissions()`, que expone `hasFeatureAccess(route)`;
  - el equipo sale de `useTeamAndClub().team.id`;
  - `COACH_FEATURE_ROUTES.GameModel` = `/coach/game-model`.
- Avisos: bus `rffm.show_snackbar` (`react.md` §6.3).

## Decisions

### D1 · Servicio: `apps/coach/services/playerTrackingService.ts`

```ts
export type ObservationAssessment = "Achieved" | "Partial" | "NotAchieved";

export type PlayerObservation = {
  id: string; date: string; kind: string;
  subprincipioId: string | null; momentName: string | null;
  principleLabel: string | null; subprincipioLabel: string | null;
  assessment: ObservationAssessment; comment: string | null; createdAt: string;
};

export type CreatePlayerObservationRequest = {
  date: string; subprincipioId: string; assessment: ObservationAssessment; comment?: string | null;
};

export async function getPlayerObservations(teamId: string, teamPlayerId: string): Promise<PlayerObservation[]>;
export async function createPlayerObservation(teamId: string, teamPlayerId: string, request: CreatePlayerObservationRequest): Promise<PlayerObservation>;
```

Usa el cliente Axios único (`core/api/client`). Etiquetas en español en el mismo archivo:

```ts
export const ASSESSMENT_LABELS: Record<ObservationAssessment, string> =
  { Achieved: "Lo hace", Partial: "A veces", NotAchieved: "No lo hace" };
```

### D2 · Hooks (`pages/player/hooks/`)

- `usePlayerObservations(teamId, teamPlayerId)` → `{ observations, loading, error, reload, create }`.
  - `create` llama al servicio y, si va bien, inserta el resultado y reordena por `date` desc y
    `createdAt` desc, sin volver a pedir la lista.
  - Mensaje de error: «No se pudieron cargar las observaciones».
- `useSubprincipioOptions(teamId)` → `{ options, loading, hasModel }`.
  - Obtiene la temporada activa y el `GameModel`, y lo aplana en
    `{ id: apiId, label: "2.3 Circular para desordenar", group: "Ataque organizado › 2. Ataque posicional" }`.
  - Mantiene el orden del modelo y descarta los subprincipios sin `apiId`.
  - `hasModel = false` si no hay temporada activa o no hay modelo.

### D3 · Componentes (`pages/player/components/tracking/`)

- **`PlayerTrackingPanel.tsx`** (+ `.module.css`) recibe `teamId` y `teamPlayerId`, usa los dos hooks y
  compone formulario y lista.
- **`ObservationForm.tsx`** (+ `.module.css`) recibe `options`, `hasModel`, `onSubmit(request)` y
  `saving`.
  - Subprincipio con `Autocomplete` de MUI (`groupBy` = `group`).
  - Fecha con `TextField type="date"`: valor inicial hoy e `inputProps.max` hoy.
  - Valoración con `ToggleButtonGroup` exclusivo de tres botones grandes (✅ Lo hace / 🟡 A veces /
    ❌ No lo hace), con `aria-label` por botón.
  - Comentario multilínea con `maxLength` 500.
  - «Guardar» deshabilitado sin subprincipio, sin valoración o mientras guarda.
  - Tras guardar se limpian subprincipio, valoración y comentario, y **se mantiene la fecha**.
  - `hasModel = false` → `Alert` informativa: «El equipo no tiene modelo de juego en la temporada
    activa. Créalo en Modelo de juego para registrar observaciones.»
- **`PlayerObservationList.tsx`** (+ `.module.css`): tarjetas `Paper` apiladas, sin tablas
  (`react.md` §4).
  - Cabecera con la fecha `dd/MM/yyyy` (`date-fns`) y un `Chip` de valoración: `success`, `warning`
    o `error`.
  - Una línea «Fase · Principio» en texto secundario, el subprincipio en negrita y el comentario.
  - Estados:
    - carga: `CircularProgress`;
    - error: `Alert` con botón «Reintentar»;
    - vacío: «Aún no hay observaciones para este jugador».
- Avisos del resultado de guardar por el bus `rffm.show_snackbar`: «Observación guardada» (`success`)
  o el `detail` del ProblemDetails / «No se pudo guardar la observación» (`error`).
- Estilos con CSS Modules y tokens del tema Coach, sin `style={{}}`. Mobile-first: a ~360 px el
  formulario ocupa una columna y los botones de valoración se reparten el ancho.

### D4 · Pestaña en `PlayerDetail.tsx`

- `const canTrack = hasFeatureAccess(COACH_FEATURE_ROUTES.GameModel);`
- Se añade `{canTrack && <Tab label="Seguimiento" />}` **después** de «Lesiones» (índice 7). Así los
  índices 0-6 no cambian.
- Panel: `{activeTab === 7 && canTrack && team?.id && <PlayerTrackingPanel teamId={team.id} teamPlayerId={teamPlayer.id} />}`.

## Risks / Trade-offs

- Si el modelo de juego es de otra temporada distinta de la activa, no se listan sus subprincipios.
  Es el mismo criterio que `ModelRelationSection` y suficiente para esta entrega.
- El alta no refresca la lista desde el servidor; inserta el DTO devuelto. La recarga completa queda
  disponible con `reload`.
