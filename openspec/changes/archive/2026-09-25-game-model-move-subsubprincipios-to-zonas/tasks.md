## 1. Backend — mover sub-subprincipios en `UpdateGameModel` (TDD, Postgres real)

- [x] 1.1 Red: `UpdateGameModelMoveSubSubPrincipioTests.cs` (nuevo, misma fixture que `UpdateGameModelHandlerTests.cs`) —
      - general → zona existente: mismo id, cuelga de la zona, conserva habilidad, y un
        `TrainingSessionSubSubPrincipio` que lo apuntaba sigue existiendo;
      - general → zona nueva: la zona se crea y el sub-subprincipio conserva su id;
      - zona → general: mismo id, `ZonaId` nulo, `SubprincipioId` del subprincipio;
      - sub-subprincipio que no aparece en la petición: se elimina (regresión);
      - subprincipio con general + zona a la vez: se guardan los dos.
- [x] 1.2 Green: `UpdateGameModel.cs` según design.md D1.
- [x] 1.3 `dotnet test --filter UpdateGameModelHandlerTests` en verde (y el resto de tests de
      GameModels).

## 2. Backend — cobertura con generales (TDD)

- [x] 2.1 Red: `GetAdnCoverageHandlerTests.cs` — subprincipio con zona (su único
      sub-subprincipio usado) y un general sin usar → subprincipio "en curso", y el general aparece
      en `SubSubPrincipios` de la respuesta.
- [x] 2.2 Green: `GetAdnCoverage.cs` según design.md D2.

## 3. Front — `MOVE_SSP` en el draft (TDD)

- [x] 3.1 Red: `context/__tests__/GameModelDraftContext.test.tsx` — general → zona, zona → general,
      zona → otra zona; conserva `apiId`, habilidades y notas; origen = destino no cambia nada.
- [x] 3.2 Green: `GameModelDraftContext.tsx` según design.md D3.

## 4. Front — editor (TDD)

- [x] 4.1 Red: `pages/game-model/components/__tests__/GameModelFormEditor.test.tsx` —
      - "Añadir zona" visible con generales y sin zonas;
      - con zona + general, el general se ve bajo "Sin zona (generales)";
      - elegir una zona en el selector "Zona" mueve el sub-subprincipio a esa zona;
      - sin zonas no hay selector "Zona".
- [x] 4.2 Green: `GameModelFormEditor.tsx` según design.md D4.

## 5. Front — tablero (TDD)

- [x] 5.1 Red: `dragPayload` — `flattenSubprincipioTargets` y los mapas incluyen generales de un
      subprincipio con zonas; `AdnDraggableTree` muestra el grupo "Sin zona" con el general.
- [x] 5.2 Green: `dragPayload.ts`, `AdnDraggableTree.tsx` según design.md D5.

## 6. Front — guardar sin salir del editor (TDD, añadido a petición del usuario)

- [x] 6.1 Red: `pages/game-model/__tests__/GameModelCreate.returnTo.test.tsx` — guardar bien se
      queda en el editor, muestra alerta de éxito y recarga el modelo; guardar mal muestra el
      `detail` del backend o "No se pudo guardar el modelo." y se queda; crear pasa a `/edit`;
      cancelar sigue volviendo a `returnTo`.
- [x] 6.2 Green: `GameModelCreate.tsx` (alertas por `rffm.show_snackbar`, `SET_DRAFT` con el
      modelo recargado) y deltas MODIFIED de los requisitos de `returnTo` en `game-model` y
      `season-plan-content-board`.

## 7. Verificación

- [x] 7.1 `cd Back/ExtractionApi && dotnet build && dotnet test` en verde.
- [x] 7.2 `cd Front && npm run test && npm run build` en verde (379/379 archivos con la máquina libre; los fallos previos eran timeouts por carga).
- [x] 7.3 Revisión manual: mover un sub-subprincipio usado en una sesión a una zona, guardar, y
      comprobar que la sesión sigue teniendo el objetivo; revisión visual a ~375px y escritorio. (Revisado por el usuario.)
- [x] 7.4 `openspec validate game-model-move-subsubprincipios-to-zonas --strict` sin errores.
