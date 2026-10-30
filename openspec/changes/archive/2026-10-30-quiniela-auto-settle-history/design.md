## Context

`SettleQuiniela` y `OpenQuiniela` son handlers solo para el entrenador. `QuinielaScoring.Score` ya
rechaza liquidar sin partidos válidos (`QuinielaNoValidMatches`) o con partidos sin resultado
(`QuinielaMatchesNotFinished`). El cierre de boletos ya existe en backend (`EnsurePicksOpen`) y en la
home (`picksClosed` → estado «closed»). La home solo muestra `previous` cuando no hay jornada abierta.
El proyecto ya usa `BackgroundService` + `PeriodicTimer` (`MatchResultNotificationWorker`).

## Decisions

### D1. Servicio de liquidación compartido
Extraer el cuerpo de `SettleQuiniela.Handler` a `QuinielaSettlementService.SettleAsync(jornada, now)`
(scoped, en `Features/Coaches/Quiniela/`), y el de `OpenQuiniela` a `OpenNextAsync(teamId, now)` que
devuelve `null` si no hay próxima jornada (el handler manual sigue lanzando `QuinielaNoNextRound`).
Los handlers pasan a delegar; el comportamiento manual no cambia (los tests existentes siguen en verde).

### D2. Worker `QuinielaAutoCloseWorker`
`BackgroundService` con `PeriodicTimer` (`Quiniela:AutoClosePollMinutes`, por defecto 10). Cada ciclo,
por cada jornada `Open`: cargar la ronda, comprobar «≥1 partido válido y todos finales» (mismo predicado
que `Score`, expuesto como `QuinielaRound.IsComplete`); si se cumple, liquidar y luego intentar abrir la
siguiente. Cada jornada en su propio `try/catch` + scope: un fallo se registra y no detiene al resto.
La apertura tras liquidar corre en un segundo `SaveChanges`: si falla, la liquidación ya es firme y el
siguiente ciclo no abre nada (no hay jornada `Open`), así que la apertura se reintenta también para
equipos cuya última jornada liquidada no tiene sucesora y tienen ronda pendiente.

### D3. Idempotencia y concurrencia
`QuinielaJornada` gana `xmin` como token de concurrencia (patrón del monedero). Si worker y entrenador
liquidan a la vez, uno recibe `DbUpdateConcurrencyException`: el servicio recarga y, si ya está
`Settled`, devuelve el resultado existente sin repetir el movimiento de fondo. El worker lo trata como
éxito silencioso. Migración en commit aparte.

### D4. Histórico: endpoint nuevo, paginado
`GET /api/teams/{teamId}/quiniela/history?limit=10&offset=0` → `QuinielaHistoryDto(Total, Items[])` con
`QuinielaHistoryItemDto` = `QuinielaPreviousDto` ampliado con `Collected` y `PrizePool`. Reutiliza la
construcción de ganadores de `GetCurrentQuiniela.LoadPreviousAsync` extraída a `QuinielaSupport`
(una sola consulta de tickets por página, sin N+1). Roles: `ParticipantRoles`. `limit` máx. 50.

### D5. Frontend
- `QuinielaPromoCard`: estado `closed` muestra «Cerró {hora}» en vez de «En juego» y, sin boleto,
  «No participas en esta jornada»; CTA «Ver mi boleto».
- La home pinta `QuinielaWinnersCard` (con premio propio destacado y enlace «Ver histórico») junto a la
  tarjeta abierta mientras `previous` exista y la jornada abierta no esté cerrada (`!picksClosed`).
- Nueva `QuinielaHistory.tsx` en `/coach/quiniela/historico` (lazy, mismo `RequireFeaturePermission`):
  tarjeta de jornada actual (reutiliza el cálculo de estado de `QuinielaPromoCard`, extraído a
  `quinielaHelpers.ts`) + lista paginada («Cargar más») de tarjetas de jornada con ganadores.
- `Quiniela.tsx`: enlace «Histórico» y refuerzo de solo lectura (ya usa `closed`).
- El histórico es el sitio permanente de resultados: entrada «Histórico de quinielas» en el menú del
  equipo (`teamNavRoutes.ts`/`teamSections.ts`, para todo usuario con acceso) y enlace «Ver resultados
  anteriores» en la tarjeta de la quiniela de la home siempre que `previous` exista (no depende de la
  ventana de la tarjeta de resultados, que es solo un aviso temporal).
- Sin tablas, CSS Modules, mobile-first, bus `rffm.show_snackbar` para errores puntuales.

### D6. Versionado
API 1.40.0 → 1.41.0 y web 1.98.0 → 1.99.0 (comprobar la vigente al implementar).

## Risks / Trade-offs

- El worker corre por instancia: con varias instancias de la API conviven varios workers; D3 lo cubre
  sin necesidad de bloqueo distribuido.
- Un resultado corregido por la RFFM tras liquidar no se re-liquida (igual que hoy con el manual).
- La apertura automática puede abrir una jornada que el entrenador no quería; mitigación: se puede
  reiniciar con `ResetQuiniela` (reembolsa monederos).
