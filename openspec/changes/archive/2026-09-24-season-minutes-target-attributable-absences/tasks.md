## 1. Backend (TDD) — back-specialist

- [x] 1.1 `GetTeamPlayerStatisticsHandlerTests.cs` (Red), equipo U14 (Cadete, 80'):
      - A 130'/400' → `Met`;
      - B 100' + 2 ausencias `Deconvoke` Lesión → `NotMetByOwnAbsences`, ≈ 41,7;
      - C 60' + 1 ausencia `UnexcusedAbsence` → `NotMet`, 18,75;
      - D ausente en todos → `null` y `NotMetByOwnAbsences`;
      - convocado presente con 0' → minutos disponibles sin descontar;
      - decisión técnica y no convocado → no restan;
      - categoría no F11 → ambos `null`, lista presente;
      - lista: `Kind`/`Reason`/`Opponent` (rival y nombre de evento), orden por fecha,
        `Count == MatchesAbsentAttributableToPlayer`.
- [x] 1.2 `GetTeamPlayerStatistics.cs` (Green): Decisiones 1-4.
- [x] 1.3 `dotnet build` y `dotnet test` en verde.

## 2. Frontend (TDD) — front-specialist

- [x] 2.1 `teamPlayerStatisticsService.ts`: tipos nuevos (`MinutesTargetStatus`,
      `AttributableAbsence`) y test del servicio.
- [x] 2.2 `playerStatsText.test.ts` (Red): textos del veredicto y de la línea de ausencia.
- [x] 2.3 `SquadStatistics.minutesTargetVerdict.test.tsx` (Red): veredicto, tramo de ausencias,
      botón y desplegable de ausencias, sin botón con 0, sin tablas.
- [x] 2.4 `playerStatsText.ts`, `SquadStatistics.tsx` y `.module.css` (Green).
- [x] 2.5 `squadStatsPdfExport.test.ts` (Red) y `squadStatsPdfExport.ts` (Green).
- [x] 2.6 Ajustar fixtures de `PlayerStatistics` en los tests existentes.
- [x] 2.7 `npm run test` y `npm run build` en verde; comprobación visual validada por el usuario (se añade flecha de desplegar al botón de ausencias).

## 3. Verificación

- [x] 3.1 `openspec validate season-minutes-target-attributable-absences --strict`.
