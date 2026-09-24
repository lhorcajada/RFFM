## 1. Backend (TDD) — back-specialist

- [x] 1.1 Tests de `SaveMatchParticipation` (Red): guarda la duración con `finished`; sin el campo
      no cambia la guardada; fuera de 0-200 → 400.
- [x] 1.2 Test de `GetMatchParticipation` (Red): devuelve `MatchDurationMinutes`.
- [x] 1.3 `GetTeamPlayerStatisticsHandlerTests` (Red): caso real 50' → 31,2 (31,25) con dos partidos de
      Cadete sin duración; duración guardada 70; duración 0 → 80; minutos limitados a la
      duración; `MatchMinutes` de la ausencia con la categoría. Ajustar los tests existentes que
      dependían del máximo de minutos jugados.
- [x] 1.4 `SportEvent.MatchDurationMinutes` + configuración EF (Green).
- [x] 1.5 Migración `AddMatchDurationMinutesToSportEvent` (commit separado).
- [x] 1.6 `SaveMatchParticipation` (campo + validador), `GetMatchParticipation`,
      `GetTeamPlayerStatistics` (Decisión 4) (Green).
- [x] 1.7 `dotnet build` y `dotnet test` en verde.

## 2. Frontend (TDD) — front-specialist

- [x] 2.1 Tipos del servicio de participación: `matchDurationMinutes` en payload y respuesta.
- [x] 2.2 Tests de `useLiveMatch` (Red): autorrelleno al terminar (minuto final; 2 × parte si 0);
      se envía en el payload; se restaura desde el backend.
- [x] 2.3 Tests de `LiveMatchManualEditDialog` (Red): campo prellenado, validación, se guarda.
- [x] 2.4 `useLiveMatch.ts`, `LiveMatchManualEditDialog.tsx` y su conexión en
      `PartidoEnDirectoTab.tsx` (Green).
- [x] 2.5 Tests del área y `npm run build` en verde; comprobación en la app validada por el usuario.

## 3. Verificación

- [x] 3.1 `openspec validate match-played-duration --strict`.
