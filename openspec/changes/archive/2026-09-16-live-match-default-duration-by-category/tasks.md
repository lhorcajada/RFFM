## 1. Backend — `StandardHalfDurationMinutes` en `GetTeam`

- [x] 1.1 Añadir `StandardHalfDurationMinutes` (`int?`) al record `TeamResponse` en
      `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Queries/GetTeam.cs`, resuelto con
      `MatchDurationMinutesByCategory.TryGetMinutes(team.CategoryId, out var minutes)`.
- [x] 1.2 Test xUnit: categoría F11 (U10=30, Youth=45) → valor correcto; categoría no F11 → `null`.
      Seguir el patrón de `GetTeamPlayerStatisticsHandlerTests.cs`.
- [x] 1.3 Verificar: `dotnet build` y `dotnet test --filter GetTeam` (o el filtro que aplique) en
      verde.

## 2. Frontend — tipo y fetch

- [x] 2.1 Añadir `standardHalfDurationMinutes: number | null` a `TeamResponse` en
      `Front/src/apps/coach/services/teamService.ts`.

## 3. Frontend — `SimulacionTab.tsx`

- [x] 3.1 Test Vitest (Red): `SimulacionTab.matchDurationByCategory.test.tsx` — con
      `standardHalfDurationMinutes: 30`, el campo de duración por defecto muestra 30 en vez del
      hardcode actual (35); con `null`, se mantiene 35; con edición manual previa, el fetch no la
      sobrescribe.
- [x] 3.2 Implementación (Green): fetch de `getTeamById(teamId)`, `halfDurationTouchedRef`, efecto
      de aplicación condicional, wrapper `handleHalfDurationChange` — según `design.md`.
- [x] 3.3 Verificar suite del archivo en verde; no romper `SimulacionTab.*.test.tsx` existentes.

## 4. Frontend — `PartidoEnDirectoTab.tsx`

- [x] 4.1 Test Vitest (Red): `PartidoEnDirectoTab.matchDurationByCategory.test.tsx` — mismos casos
      que 3.1 pero contra el default hardcodeado de 45 y `live.matchPhase === "preMatch"`.
- [x] 4.2 Implementación (Green): mismo patrón que 3.2, adaptado a `useLiveMatch`.
- [x] 4.3 Verificar suite del archivo en verde; no romper `PartidoEnDirectoTab.*.test.tsx`
      existentes (en particular `timerPersistence` recién tocado en el fix previo).

## 5. Verificación final

- [x] 5.1 `dotnet build && dotnet test` (backend) en verde — 1249/1249.
- [x] 5.2 `npm run build && npm run test` (frontend) en verde — build sin errores; 313/314
      archivos, 1589/1593 tests (3 skipped, 1 fallo pre-existente ajeno en
      `TeamRulesEdit.test.tsx` no relacionado con este cambio).
- [ ] 5.3 Confirmar con el usuario antes de cualquier commit (regla `git.md` §6.3).
