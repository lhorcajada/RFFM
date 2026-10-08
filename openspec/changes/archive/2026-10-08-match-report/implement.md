# Implement — match-report

Guion técnico. Seguir `tasks.md` en orden y `design.md` (D1–D7). TDD estricto: cada bloque empieza
por el test, se ejecuta en rojo y después se implementa.

## Backend (`Back/ExtractionApi`)

1. **StartingLineupJson (D4)**
   - `Domain/Entities/TeamPlayers/MatchParticipation.cs`: propiedad `string? StartingLineupJson`;
     parámetro opcional `startingLineupJson` al final de `Create` y `Update` (en `Update` solo se
     asigna si no es null).
   - `MatchParticipationEntityConfiguration`: `builder.Property(x => x.StartingLineupJson);`.
   - `SaveMatchParticipation.SaveMatchParticipationRequest.StartingLineupJson` y pasarlo a `Create`/`Update`.
   - Migración: `.\manage-migrations.ps1 -Action create -MigrationName AddStartingLineupToMatchParticipation`.
   - Test: `tests/RFFM.Api.Tests/UnitTests/SaveMatchParticipationStartingLineupTests.cs`
     (patrón `SaveMatchParticipationHandlerTests`, `PostgresCollection`).
2. **Features/Coaches/MatchReports/** (namespace `RFFM.Api.Features.Coaches.MatchReports`)
   - `MatchReportRules.cs`: `HasFederationReport(eventTypeId, codActa, localGoals, visitorGoals)`,
     `FinishedPhase = "finished"`, `MatchCategory(eventTypeId)` (usa `SportEventsConstants`).
   - `GetTeamMatchReports.cs` (D1), `GetMatchReport.cs` + `LiveMatchReportBuilder.cs` (D2),
     `GetEventFederationActa.cs` (D3). Queries `IQueryApp<T>` + `IRequireFeaturePermission`
     (`CoachFeatureRoutes.Convocations`, `Read`) + `IRequireTeamMembership`.
   - Tests de endpoint: host de `LotteryEndpointTests` (Mediator + `FeaturePermissionBehavior` +
     `TeamMembershipBehavior` + `AddCustomProblemDetails`), sembrar permisos `Convocations` para
     Coach/Player/FamilyMember. `IActaService` sustituido por un stub en `GetEventFederationActaTests`.
   - `Features/Mobile/Competitions/Queries/GetTeamCalendar.cs`: `CodActa` en `MobileMatchDto`.
3. `<Version>1.20.0</Version>`. Verify: `dotnet build`, `dotnet test`.

## Front (`Front`)

4. `git mv` de `apps/federation/components/acta/*` → `shared/components/acta/*` y
   `apps/federation/types/acta.ts` → `shared/types/acta.ts`; arreglar imports (`grep -rn "components/acta\|types/acta"`).
   Extraer `shared/components/acta/ActaContent/ActaContent.tsx`.
5. `useLiveMatch`: `options.getStartingFormation?: () => { id: string; name: string } | null`;
   `persistMatchParticipation` añade `startingLineupJson` con `{ formationId, formationName, slots: initialSlotsRef.current }`.
   `PartidoEnDirectoTab` pasa la función a partir de `formationId`/`formations`.
6. `apps/coach/services/matchReportService.ts`, `apps/coach/hooks/useTeamMatchReports.ts`,
   `apps/coach/pages/matchReport/` (página + `components/` + CSS Modules), ruta lazy `match-report`.
7. Botón «Ver acta»: `MatchCard`, `AgendaList` (`onViewReport`), `Convocations`, `RoundPanel`
   (`renderMatchAction`), `Results`. `npm version 1.29.0 --no-git-tag-version`.
   Verify: `npm run test`, `npm run build`.

## Mobile (`Mobile`)

8. Leer `Mobile/AGENTS.md`. `src/api/matchReports.ts`, `src/utils/formationPositions.ts`,
   `screens/MatchReportScreen.tsx`, `screens/components/matchReport/*`, `EventCard.onViewReport`,
   pantallas Calendar/Friendlies/Tournaments/League, registro `MatchReport` en ambos stacks.
   `version` 1.2.0 en `app.json` y `package.json`. Verify: `npm test`.

## Cierre

9. `openspec validate match-report --strict`; mostrar `git status` y pedir confirmación para commits.
