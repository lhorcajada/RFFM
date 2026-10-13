## 1. Backend: lote de valoraciones (~2h)

- [x] 1.1 Red: `tests/RFFM.Api.Tests/UnitTests/CreateTeamRatingsBatchTests.cs` (Postgres,
  `AvailabilityTestSupport`):
  - dos jugadores → dos valoraciones con la misma fecha y medias por categoría;
  - las notas se guardan por jugador;
  - la valoración anterior se conserva;
  - jugador de otro equipo → `DomainException` `RatingPlayerNotInTeam` y nada guardado;
  - equipo inexistente → `NotFoundException`;
  - entrenador de otro equipo → `ForbiddenAccessException`; Administrator → permitido.
- [x] 1.2 Red: `tests/RFFM.Api.Tests/UnitTests/CreateTeamRatingsBatchValidatorTests.cs`: lote
  vacío, más de 100, jugador repetido, sin respuestas, nivel 0 y 11, característica repetida,
  claves vacías, lote válido.
- [x] 1.3 Green: `Features/Coaches/Players/Commands/CreateTeamRatingsBatch.cs` (D1) y
  `ErrorCodes.RatingPlayerNotInTeam`.
- [x] 1.4 `Directory.Build.props` → `1.25.0`.
- **Verify**: `dotnet test --filter "CreateTeamRatingsBatch"`; `dotnet build`.

## 2. Front: lógica de la hoja (~1.5h)

- [x] 2.1 Red: `pages/squad/rating/__tests__/ratingSheet.test.ts`: borrador inicial desde la
  última valoración, respuestas ajenas a la hoja ignoradas, jugadores cambiados, completo /
  incompleto, items del lote (respuestas completas, concepto del catálogo, notas conservadas).
- [x] 2.2 Green: `rating/positionCategory.ts` (extraído; `NewRatingPage` y `SquadRatings` lo
  importan) y `rating/ratingSheet.ts` (D2).
- [x] 2.3 Red + Green: `services/__tests__/playerRatingService.batch.test.ts` →
  `createTeamRatings(teamId, payload)`.
- **Verify**: `npm run test -- ratingSheet playerRatingService NewRatingPage SquadRatings`.

## 3. Front: página «Valorar plantilla» (~2h)

- [x] 3.1 Red: `pages/squad/rating/__tests__/RatingSheetPage.test.tsx`:
  - jugador en el nivel de su última valoración; sin valoración → «Sin colocar»;
  - porteros solo en «Porteros»;
  - progreso «2/3»;
  - tocar jugador + nivel lo coloca; dos jugadores a la vez; volver a «Sin colocar»;
  - filtro «Defensas»; sin filtro en «Porteros»;
  - sin rol Coach/Administrator → sin «Guardar» y sin cambios al tocar.
- [x] 3.2 Green: `useRatingSheet.ts`, `components/RatingSheetBoard.tsx`, `RatingSheetPage.tsx` y
  sus CSS Modules (D3–D5).
- **Verify**: `npm run test -- RatingSheetPage`.

## 4. Front: guardado, entrada y versión (~1.5h)

- [x] 4.1 Red: `RatingSheetPage.test.tsx` (bloques «guardar» y «volver»): solo los cambiados y completos; aviso de
  incompletos; «Guardar» deshabilitado sin cambios; error → snackbar y se conserva lo colocado;
  «Volver» con cambios → `ConfirmDialog`.
- [x] 4.2 Green: guardado en `useRatingSheet` + barra de acciones.
- [x] 4.3 Red + Green: `SquadRatings.ratingSheet.test.tsx` → botón «Valorar plantilla» (oculto en
  `readOnly`); ruta lazy `squad/rating-sheet` en `routes.tsx` (D6).
- [x] 4.4 `npm version 1.47.0 --no-git-tag-version`.
- [ ] 4.5 Comprobación visual a 360px y en escritorio (tema Coach).
- **Verify**: `npm run build`; `npm run test` (suite completa en verde).

## 5. Cierre

- [x] 5.1 `openspec validate squad-rating-sheets --strict`.
- [x] 5.2 Commits (`feat(mcp-api)` y `feat(front)` por separado), solo tras la confirmación del
  usuario.
