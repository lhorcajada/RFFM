## Why

Al planificar sesiones en el tablero de contenido (`ContentBoardPage`), el entrenador ve de cada
sub-subprincipio su número, rol y texto, pero no sus **habilidades imprescindibles**
(Perfilamiento, Pase, Anticipación…), que son justo lo que tiene que entrenar en la sesión. Esos
datos ya están en el Modelo de Juego y el tablero ya los carga, pero no se muestran.

Además, si al planificar detecta algo que corregir en el modelo, tiene que salir del tablero, ir
a Modelo de Juego, editar y volver a navegar hasta el tablero (perdiendo el filtro de microciclo).

## What Changes

- Cada sub-subprincipio muestra sus habilidades imprescindibles como chips:
  - en el árbol ADN del panel izquierdo (`AdnDraggableTree`);
  - en los objetivos de cada tarjeta de sesión (`SessionTargetTree`).
  Al pulsar o pasar el ratón por un chip se ve su descripción y si es entrenable. Si la habilidad
  remite a otro sub-subprincipio (`referenciaAKey`), se indica "Igual que {key}".
- Las habilidades se leen del modelo cargado (no se guardan en la sesión), así que reflejan
  siempre el modelo actual.
- El tablero tiene un botón "Editar modelo" que abre el editor existente
  (`/coach/game-model/edit`). Al guardar o cancelar, el editor vuelve al tablero con la misma URL
  (incluido `microcicloId`) y el tablero recarga el modelo.
- Cuando el equipo no tiene modelo, el estado vacío del tablero ofrece "Crear modelo", que abre
  `/coach/game-model/create` y vuelve igualmente al tablero.
- El editor de modelo acepta un `returnTo` en el state de navegación; sin él, sigue volviendo a
  `/coach/game-model` como ahora.

## Non-goals

- No se guardan habilidades en la sesión ni se pueden quitar/añadir por sesión.
- No hay edición del modelo dentro del propio tablero (diálogos inline).
- Sin cambios de backend: `GetGameModel` ya devuelve `Habilidades` por sub-subprincipio.

## Capabilities

### Modified Capabilities
- `season-plan-content-board`: muestra habilidades imprescindibles y enlaza al editor del modelo.
- `game-model`: el editor admite volver a la pantalla de origen (`returnTo`).

## Impact

- Frontend (`front-specialist`) únicamente:
  `season-plan/ContentBoardPage.tsx`, `season-plan/components/{AdnDraggableTree,SessionTargetTree,SessionCard,SessionBoardPanel}.tsx`,
  `season-plan/components/dragPayload.ts` (mapa de habilidades), un componente nuevo
  `season-plan/components/HabilidadChips.tsx`, `pages/game-model/GameModelCreate.tsx`, y sus tests.
- Backend (`Back/ExtractionApi`): sin cambios.
