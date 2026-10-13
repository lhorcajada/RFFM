# Implement — squad-rating-sheets

Guion técnico. Seguir `tasks.md` en orden y `design.md` (D1–D6). TDD estricto: cada bloque empieza
por el test, se ejecuta en rojo y después se implementa.

## Backend (`Back/ExtractionApi`)

1. **Tests** en `tests/RFFM.Api.Tests/UnitTests/`:
   - `CreateTeamRatingsBatchTests.cs`: `[Collection(PostgresCollection.Name)]`, patrón de
     `RequestAvailabilityTests` (`SeedTeamAsync`, `SeedPlayerAsync`, `SeedCoachAsync`,
     `CurrentUser` de `AvailabilityTestSupport`). Handler: `new CreateTeamRatingsBatch.Handler(db, currentUser)`.
   - `CreateTeamRatingsBatchValidatorTests.cs`: `new CreateTeamRatingsBatch.Validator().Validate(command)`.
2. **`Features/Coaches/Players/Commands/CreateTeamRatingsBatch.cs`** (D1): ruta
   `POST /api/catalog/team/{teamId}/ratings`, `[Authorize(Roles = "Coach,Administrator")]`,
   `RFFM.Api.Common.ICommand<IReadOnlyList<CreateConceptualRating.ConceptualRatingResponse>>`,
   `Validator`, `Handler(AppDbContext, ICurrentUserService)`. Respuesta con
   `CreateConceptualRating.ToResponse`.
3. `Domain/ErrorCodes.cs`: `RatingPlayerNotInTeam`.
4. `<Version>1.25.0</Version>`. Verify: `dotnet build`, `dotnet test`.

## Front (`Front/src/apps/coach`)

5. `pages/squad/rating/positionCategory.ts`: mover `positionCategory`, `positionAccent` e
   `isGoalkeeperPosition`; sustituir las copias de `NewRatingPage.tsx` y `SquadRatings.tsx`.
6. `pages/squad/rating/ratingSheet.ts` (D2) + `__tests__/ratingSheet.test.ts`.
7. `services/playerRatingService.ts`: `createTeamRatings(teamId, { ratedAt, ratings })` →
   `POST /api/catalog/team/${teamId}/ratings`.
8. `pages/squad/rating/useRatingSheet.ts`, `components/RatingSheetBoard.tsx`,
   `RatingSheetPage.tsx` (+ CSS Modules, D3–D5). `teamId`/`seasonId` de `useSearchParams`.
   Tests con los mismos mocks de layout que `NewRatingPage.test.tsx`.
9. `SquadRatings.tsx`: botón «Valorar plantilla». `routes.tsx`: ruta lazy `squad/rating-sheet`.
10. `npm version 1.47.0 --no-git-tag-version`. Verify: `npm run test`, `npm run build`.

## Cierre

11. `openspec validate squad-rating-sheets --strict`; mostrar `git status` y pedir confirmación
    para los commits.
