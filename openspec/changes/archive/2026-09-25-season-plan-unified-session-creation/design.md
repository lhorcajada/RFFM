## Context

- `Trainings.tsx` (pestaña Planificación) muestra "Planificar contenido" (→ `content-board`) y
  "Editar/Nueva planificación". `SeasonPlanView` llama a `onCreateSession(microcicloId)` y
  `Trainings` lo resuelve con `goToSessionPage(undefined, microcicloId)` (editor de sesión).
- `ContentBoardPage.tsx` carga Modelo de Juego, cobertura y **todas** las sesiones del equipo
  (`useContentBoardData`) y crea sesiones con `microcicloId: null`.
- Backend: `CreateSession` acepta `MicrocicloId` con `Date` nula (valida que el microciclo sea
  del equipo). `UpdateSession` conserva el `MicrocicloId` enviado. `GetSessions` devuelve
  `MicrocicloId`/`MicrocicloWeekLabel`. **No hace falta tocar el backend.**

## Decisions

### D1 · El microciclo viaja en la query string; la etiqueta, en el state de navegación
`microcicloId` va en la URL (sobrevive a recargas y al "Volver" desde el editor de sesión, que usa
`returnTo`). `weekLabel`/`startDate`/`endDate` se pasan en `location.state.microciclo` desde
`Trainings`, que ya tiene `seasonPlan` cargado (se busca el microciclo por `apiId`). Si no hay
state (recarga o enlace directo), la cabecera usa el `microcicloWeekLabel` de la primera sesión
filtrada o, si no hay ninguna, el texto "Microciclo seleccionado". No añadimos otra carga del
plan solo para la etiqueta.

`SeasonPlanView` no cambia: su contrato `onCreateSession(microcicloId)` se mantiene.

```tsx
// Trainings.tsx
const goToContentBoard = (microcicloId?: string) => {
  const qs = new URLSearchParams({ clubId, teamId });
  if (microcicloId) qs.set("microcicloId", microcicloId);
  const microciclo = microcicloId ? findMicrocicloByApiId(seasonPlan, microcicloId) : null;
  navigate(`/coach/trainings/content-board?${qs}`, {
    state: microciclo
      ? { microciclo: { weekLabel: microciclo.weekLabel, startDate: microciclo.startDate, endDate: microciclo.endDate } }
      : undefined,
  });
};
// <SeasonPlanView onCreateSession={(id) => goToContentBoard(id)} ... />
```

`findMicrocicloByApiId` es una función pura co-ubicada en `season-plan/findMicrociclo.ts`
(recorre macro → meso → micro).

### D2 · Filtrado en cliente
`useContentBoardData` no cambia. `ContentBoardPage` calcula
`visibleSessions = microcicloId ? sessions.filter(s => s.microcicloId === microcicloId) : sessions`
y se lo pasa a `SessionBoardPanel`. La cobertura del árbol ADN sigue siendo la del equipo
completo: es un indicador de temporada, no de la semana.

### D3 · Creación asignada
`handleCreateSession` envía `microcicloId: microcicloId ?? null` y guarda el mismo valor (y
`isAssociatedToPlan: !!microcicloId`, `microcicloWeekLabel` de la cabecera) en el item optimista.

### D4 · Cabecera y "Ver todas las sesiones"
Con microciclo, bajo el título "Planificar contenido" aparece una línea
`{weekLabel} · {startDate} – {endDate}` y un botón de texto "Ver todas las sesiones", que navega
a la misma ruta sin `microcicloId` (`replace: true`). Estilos en `ContentBoardPage.module.css`,
que ya existe; sin colores nuevos.

### D5 · Alternativa sin Modelo de Juego
En el estado vacío (`!gameModel`), si hay `microcicloId`, se muestra además el botón
"Crear sesión sin contenido" →
`/coach/trainings/new-session?clubId&teamId&microcicloId` con
`state.returnTo = "/coach/trainings?clubId&teamId"`.

### D6 · Entrada al tablero completo
En la pestaña Sesiones (`tab === 2`), junto a "Nueva sesión", un botón `outlined`
"Tablero de contenido" → `goToContentBoard()`. Se elimina el botón "Planificar contenido" de
`tab === 0`.

## Risks / Trade-offs

- Las sesiones sin fecha que ya existen y no tienen microciclo no aparecen en la vista filtrada.
  Es lo esperado: se ven con "Ver todas las sesiones".
- Si el entrenador asigna después una fecha de otra semana en el editor, la sesión conserva el
  `microcicloId` que envía el formulario (comportamiento actual de `UpdateSession`). Queda fuera
  de este cambio.

## Files

| Archivo | Cambio |
|---|---|
| `Front/src/apps/coach/pages/trainings/Trainings.tsx` | quitar "Planificar contenido", `goToContentBoard`, botón en Sesiones, `onCreateSession` → tablero |
| `Front/src/apps/coach/pages/trainings/season-plan/findMicrociclo.ts` | nuevo, función pura |
| `Front/src/apps/coach/pages/trainings/season-plan/ContentBoardPage.tsx` (+ `.module.css`) | leer `microcicloId`, filtrar, crear asignada, cabecera, alternativa sin Modelo |
| Tests | `__tests__/ContentBoardPage.test.tsx`, `__tests__/findMicrociclo.test.ts`, nuevo `pages/trainings/__tests__/Trainings.planningActions.test.tsx` (o extender el test existente de `Trainings` si lo hay) |
