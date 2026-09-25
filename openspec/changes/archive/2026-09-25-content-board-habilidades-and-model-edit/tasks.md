## 1. Chips de habilidades (TDD)

- [x] 1.1 Red: `season-plan/components/__tests__/HabilidadChips.test.tsx` — un chip por
      habilidad; tooltip con descripción y "Entrenable: …"; "Igual que {key}" con
      `referenciaAKey`; nada con lista vacía.
- [x] 1.2 Green: `season-plan/components/HabilidadChips.tsx` (+ `.module.css`), design.md D1.

## 2. Habilidades en el árbol ADN (TDD)

- [x] 2.1 Red: `season-plan/components/__tests__/AdnDraggableTree.habilidades.test.tsx` — la
      fila de un sub-subprincipio muestra sus habilidades; sin habilidades, ningún chip.
- [x] 2.2 Green: `AdnDraggableTree.tsx`, design.md D2.

## 3. Habilidades en los objetivos de sesión (TDD)

- [x] 3.1 Red: `season-plan/components/__tests__/dragPayload.habilidadesMap.test.ts` — mapa por
      `apiId`, con sub-subprincipios directos y bajo zonas.
- [x] 3.2 Green: `buildSubSubPrincipioHabilidadesMap` en `dragPayload.ts`.
- [x] 3.3 Red: `SessionTargetTree.test.tsx` — un objetivo muestra las habilidades del mapa; sin
      `habilidadesMap`, sin chips (regresión).
- [x] 3.4 Green: `SessionTargetTree.tsx`, `SessionCard.tsx`, `SessionBoardPanel.tsx`,
      `ContentBoardPage.tsx` (mapa memoizado), design.md D3.

## 4. Editar / crear el modelo desde el tablero (TDD)

- [x] 4.1 Red: `pages/game-model/__tests__/GameModelCreate.returnTo.test.tsx` — con `returnTo`,
      guardar y cancelar vuelven a `returnTo`; sin `returnTo`, cancelar vuelve a
      `/coach/game-model`.
- [x] 4.2 Green: `GameModelCreate.tsx`, design.md D5.
- [x] 4.3 Red: `ContentBoardPage.test.tsx` — "Editar modelo" navega a `game-model/edit` con
      `season`, `teamId` y `returnTo` = URL actual (con `microcicloId`); sin modelo, "Crear
      modelo" navega a `game-model/create`.
- [x] 4.4 Green: `ContentBoardPage.tsx`, design.md D4.

## 5. Verificación

- [x] 5.1 `cd Front && npm run test` en verde.
- [x] 5.2 `cd Front && npm run build` en verde.
- [ ] 5.3 Revisión visual a ~375px y en escritorio: chips en el árbol y en las tarjetas, botón
      "Editar modelo".
- [x] 5.4 `openspec validate content-board-habilidades-and-model-edit --strict` sin errores.
