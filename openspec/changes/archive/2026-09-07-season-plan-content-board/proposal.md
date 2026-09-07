## Why

Today (`Front/src/apps/coach/pages/trainings/season-plan/SeasonPlanEditor.tsx`) a coach can only
plan a season top-down: create a Macrociclo, then Mesociclos with dates, then Microciclos with
dates, and only then pick a "subprincipio objetivo" per week from a flat, ungrouped picker
(`MicrocicloSubprincipioObjetivoPicker`). This forces the coach to have the whole season's
calendar already worked out on paper before touching content, and the objective picker gives no
Fase/Principio grouping and no Sub-subprincipio detail. Coaches want to plan *content* first —
what principles/subprincipios to work on and in which sessions — and attach dates later, once the
calendar is known.

## What Changes

- New two-panel "content board" screen: left panel renders the team's full Modelo de Juego
  (ADN) tree (Fase → Principio → Subprincipio → Zona? → Sub-subprincipio), each Subprincipio and
  Sub-subprincipio draggable; right panel is a board of "unscheduled sessions" (no date/time)
  the coach creates freely and drops content onto.
- Dragging a Subprincipio adds all its Sub-subprincipios (via its Zonas if it has them, or
  direct) as session targets; dragging a single Sub-subprincipio adds just that one. Every
  target renders with its full breadcrumb (Fase › Principio › Subprincipio › Zona › Rol).
- The same Sub-subprincipio may be added to multiple sessions — no uniqueness constraint.
- Coverage (Subprincipio/Principio "cubierto ✓") is a calculated view, never a stored flag: a
  Subprincipio is covered when every one of its Sub-subprincipios is targeted by at least one
  session (scheduled or not); a Principio is covered when all its Subprincipios are.
- Each Sub-subprincipio in the left panel shows a usage badge (count) and, on hover/detail,
  which sessions use it (name + date, or "sin programar").
- Assigning a date/hour to an unscheduled session reuses the existing session flow
  (`Front/src/apps/coach/pages/trainings/new-session/NewSessionPage.tsx`) without losing its
  targets; on save, the session's `Microciclo` is derived automatically from its date falling
  inside a `Microciclo.StartDate..EndDate` range — the coach never picks it manually.
- `SeasonPlanEditor.tsx`'s "objetivo de la semana" stops being an editable field
  (`MicrocicloSubprincipioObjetivoPicker` removed from the edit form) and becomes a read-only
  view derived from the union of Sub-subprincipio targets of sessions dated inside that
  Microciclo's range.
- **BREAKING**: `TrainingSession.Date`/`StartTime` become nullable (a session may exist with no
  schedule yet); `Microciclo.SubprincipiosObjetivo`/`ReplaceSubprincipiosObjetivo` and the
  `MicrocicloSubprincipioObjetivo` join table are retired in favor of deriving the weekly
  objective from session targets.
- Backend: `TrainingSession` gains a many-to-many join to `SubSubPrincipio` (repeats allowed,
  cascade-deletes with the referenced Sub-subprincipio, same convention as
  `ExerciseModelRelationItem`); `CreateSession`/`UpdateSession` accept a list of target
  Sub-subprincipio ids; a new `GetAdnCoverage` query returns, per Sub-subprincipio of a team's
  GameModel, whether it's covered and which sessions reference it.

## Capabilities

### New Capabilities
- `season-plan-content-board`: drag-and-drop content-first planning — Modelo de Juego tree
  source, unscheduled-session board, Sub-subprincipio session targets, calculated coverage,
  session-target-driven Microciclo weekly objective.

### Modified Capabilities
- `sessions` (implementation-only conventions under `Features/Coaches/Trainings/Sessions`, no
  existing `specs/` entry): `TrainingSession` gains nullable `Date`/`StartTime` and a
  Sub-subprincipio target list; `CreateSession`/`UpdateSession` accept/return the target list.
- `season-plan` (implementation-only conventions under `Features/Coaches/SeasonPlans`, no
  existing `specs/` entry): `Microciclo`'s weekly objective is no longer coach-editable input —
  it is derived read-only output computed from session targets.

## Impact

- Backend: `Domain/Aggregates/Training/TrainingSession.cs` (nullable `Date`/`StartTime`, new
  `SessionTargets` collection), a new `TrainingSessionSubSubPrincipio` join entity + EF config +
  migration; `Domain/Aggregates/SeasonPlans/Microciclo.cs` and
  `MicrocicloSubprincipioObjetivo.cs` (retire `SubprincipiosObjetivo`/
  `ReplaceSubprincipiosObjetivo`, drop the join table via migration);
  `Features/Coaches/Trainings/Sessions/{CreateSession,UpdateSession,GetSession,GetSessions}.cs`
  (target ids in/out, nullable date/time); new
  `Features/Coaches/GameModels/Queries/GetAdnCoverage.cs`; `AppDbContext`.
- Frontend (scoped to `front-specialist`, not detailed here): a new content-board page under
  `Front/src/apps/coach/pages/trainings/season-plan/`, reusing
  `GameModelTree.tsx`-style rendering and the existing `@dnd-kit/core` drag-and-drop pattern
  from `IdealLineup.tsx`; `SeasonPlanEditor.tsx` loses the objective picker in favor of a
  read-only view; `NewSessionPage.tsx` gains target-selection wiring and nullable date/time
  handling for unscheduled sessions.
