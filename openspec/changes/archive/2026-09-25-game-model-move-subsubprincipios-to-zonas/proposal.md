## Why

En el Modelo de Juego hay sub-subprincipios que cuelgan directamente del subprincipio (sin zona)
y el entrenador quiere organizarlos en zonas. Hoy no puede:

- El editor oculta "Añadir zona" si el subprincipio ya tiene sub-subprincipios directos, y oculta
  los directos si ya tiene zonas (`GameModelFormEditor.tsx`).
- No hay forma de mover un sub-subprincipio a una zona.
- Aunque el front lo permitiera, `UpdateGameModel` solo busca cada sub-subprincipio entre los de su
  mismo padre: un sub-subprincipio que cambia de padre se **borra y se crea otro** con otro id. Por
  el borrado en cascada se perderían los objetivos de las sesiones
  (`TrainingSessionSubSubPrincipio`) y las relaciones con ejercicios
  (`ExerciseModelRelationItem`) que apuntaban a él.
- En un subprincipio con zonas y directos a la vez, el tablero de contenido y la cobertura ADN
  ignoran los directos.

## What Changes

- **Editor del modelo**
  - "Añadir zona" siempre disponible en un subprincipio.
  - Los sub-subprincipios directos se ven siempre; si el subprincipio tiene zonas, bajo el título
    "Sin zona (generales)". "Añadir sub-subprincipio directo" siempre disponible.
  - Cada sub-subprincipio de un subprincipio con zonas tiene un selector "Zona" ("Sin zona
    (general)" + las zonas de su subprincipio) que lo mueve conservando su id, habilidades y notas.
- **Backend `UpdateGameModel`**: los sub-subprincipios se emparejan por id dentro de **todo el
  subprincipio** (directos y todas sus zonas, incluidas las zonas nuevas). Si cambia de padre, se
  reasigna (`ReparentToZona` / `ReparentToSubprincipio`) en lugar de borrarse y crearse. Solo se
  borran los que no aparecen en ninguna parte del subprincipio en la petición.
- **Mezcla permitida**: un subprincipio puede tener a la vez sub-subprincipios en zonas y
  generales; cada sub-subprincipio sigue teniendo un único padre.
- **Tablero de contenido y cobertura**: los generales de un subprincipio con zonas aparecen en el
  árbol ADN (grupo "Sin zona"), se incluyen al arrastrar el subprincipio y en los mapas de
  texto/habilidades, y cuentan en la cobertura del subprincipio.

## Non-goals

- Mover sub-subprincipios entre subprincipios distintos.
- Cambiar qué pasa al eliminar una zona (sus sub-subprincipios se siguen eliminando con ella).
- Arrastrar y soltar dentro del editor.
- Sin migraciones: el esquema ya permite `SubprincipioId` o `ZonaId`.

## Capabilities

### Modified Capabilities
- `game-model`: se permite mezclar generales y zonas en un subprincipio; el editor mueve
  sub-subprincipios entre zonas conservando su identidad.
- `season-plan-content-board`: la cobertura y el árbol incluyen los generales de un subprincipio
  con zonas.

## Impact

- Backend (`back-specialist`): `Features/Coaches/GameModels/Commands/UpdateGameModel.cs`,
  `Features/Coaches/GameModels/Queries/GetAdnCoverage.cs`, tests de integración
  `UpdateGameModelHandlerTests.cs` y `GetAdnCoverageHandlerTests.cs`.
- Frontend (`front-specialist`): `context/GameModelDraftContext.tsx`,
  `pages/game-model/components/GameModelFormEditor.tsx`,
  `pages/trainings/season-plan/components/{AdnDraggableTree.tsx,dragPayload.ts}` y sus tests.
