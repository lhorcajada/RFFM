## Why

El "Estado de forma" actual (`PlayerFormStatusCalculator`, change
`player-form-status-training-match-weighting`, aún sin archivar) es aditivo con referencias
irreales: para llegar al 100% un jugador necesita 16 sesiones (todas de tipo Físico) y 8 partidos
de 70 minutos dentro de 8 semanas. En la práctica casi nadie pasa del 50-60% y el número no
refleja lo que el entrenador quiere leer: "¿este jugador está en su forma normal?". El usuario
quiere que 100% sea lo normal para un jugador sano que asiste y juega, y que el valor baje solo
por cansancio, lesiones y faltas.

## What Changes

- **Estado de forma se rehace** como cociente carga recibida / carga ofrecida, no como suma contra
  una línea base fija:
  - Ventana de 6 semanas con recencia (7 días a peso 1.0; después decae con semivida de 14 días).
  - Entrenos (55%): sesiones asistidas / sesiones ofrecidas, ponderadas por tipo (Físico 1.00 /
    Táctico 0.50 / Técnico 0.00) y por recencia. Toda falta cuenta 0 (también lesión); solo se
    excluye la decisión técnica del entrenador.
  - Partidos (45%): minutos jugados / minutos de estímulo completo (87.5% de la duración del
    partido de la categoría; Cadete 70 min), tope 1.0 por partido, media ponderada por recencia.
    El tipo de partido no pesa.
  - Cansancio como multiplicador: `(0.55·Entrenos + 0.45·Partidos) × (1 − Cansancio/200)`.
  - Equipos de categorías sin duración estándar (F7 o menores): Estado de forma `null`.
- **BREAKING (contrato API)**: `FormStatusBreakdownDto`, `FormStatusConsideredTrainingDto` y
  `FormStatusConsideredMatchDto` se rediseñan para explicar el cálculo (ratio recibido/ofrecido,
  pesos de recencia, minutos completos, factor de cansancio). Desaparecen
  `TrainingSessionsBaseline`, `WeightedMatchMinutesInWindow`, `MatchMinutesExpected` y los pesos
  0.70/0.30.
- **Rodaje**: el peso de `Fisico` en `ReadinessTrainingWeights` pasa de `0.00` a `0.30`
  (Táctico 1.00 y Técnico 0.60 sin cambio).
- Frontend (front-specialist): `PlayerFormBars`, `SquadStatistics`, `PlayerDetail`,
  `squadStatsPdfExport` y `teamPlayerStatisticsService.ts` consumen el nuevo contrato y el
  desplegable de desglose muestra el cálculo paso a paso.

## Capabilities

### Modified Capabilities
- `player-form-status`: sustituye el modelo aditivo 70/30 sobre 8 semanas por el modelo
  recibido/ofrecido 55/45 con recencia y multiplicador de cansancio.
- `player-readiness`: el peso de entrenos `Fisico` pasa de 0.00 a 0.30.

> Ambas specs las crea (ADDED) el change previo `player-form-status-training-match-weighting`,
> todavía sin archivar (no existen aún en `openspec/specs/`). Este change DEBE archivarse
> después de aquel; sus deltas usan `MODIFIED` con los mismos encabezados de requisito.

## Impact

- Backend: reescribe `Features/Coaches/Players/Services/PlayerFormStatusCalculator.cs` (nueva
  firma y `Result`); añade un clasificador de participación compartido; ajusta
  `PlayerReadinessCalculator.cs` (un peso); `Features/Coaches/Players/Queries/GetTeamPlayerStatistics.cs`
  (nuevos DTOs, Cansancio calculado antes que Estado de forma, proyección de partidos del equipo
  en ventana, gating por `MatchDurationMinutesByCategory`). `MatchTypeWeighting` deja de usarse
  por Estado de forma (se mantiene para Cansancio/Rodaje). Sin migraciones EF ni tablas nuevas.
- Tests: reescribe `PlayerFormStatusCalculatorTests.cs`; actualiza
  `PlayerReadinessCalculatorTests.cs` y `GetTeamPlayerStatisticsHandlerTests.cs`.
- Frontend: cambios de contrato y de UI del desglose (ver `tasks.md`, sección 6).
