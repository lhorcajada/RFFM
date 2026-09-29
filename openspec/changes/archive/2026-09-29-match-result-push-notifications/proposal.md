## Why

Para saber cómo ha quedado el partido de su equipo, el usuario tiene que entrar en Resultados. Ya
hay notificaciones Web Push en la SPA (convocatorias, sanciones, noticias…), los resultados de la
RFFM se guardan en BD y sabemos cuál es el equipo de cada usuario: su combinación principal de
`FederationSetting` (competición, grupo y equipo RFFM), la misma que usa `usePrimaryTeam` para
resaltar su partido en `MatchCard`. Pero nada avisa cuando se publica el marcador.

## What Changes

- **Backend — detección**: un `BackgroundService` sondea cada pocos minutos los partidos de los
  equipos principales de los usuarios (`FederationSetting.IsPrimary`, `TeamId` + `GroupId`,
  temporada actual) que ya han podido terminar. Reutiliza `IRffmResultsSyncService` y su política
  de refresco, así que no añade llamadas a la RFFM fuera de las ya previstas. En cuanto el partido
  tiene marcador publicado (goles local y visitante), avisa **una sola vez** por usuario y partido.
- **Backend — envío**: nuevo `IWebPushNotificationDispatcher.DispatchMatchResultAsync`: crea un
  `Notification` (tipo `MatchResult`) y envía Web Push a los usuarios de ese equipo que no se hayan
  dado de baja.
- **Backend — preferencia**: activado por defecto. `GET`/`PUT /api/match-result-notifications/preference`
  lee y cambia la preferencia del usuario actual (se guarda solo la baja).
- **Frontend (Coach)**: interruptor «Notificarme los resultados» en la página de Resultados.
- **Migración**: `AddMatchResultNotifications` sobre `FederationDbContext` (baja + registro de
  envíos).

## Capabilities

### New Capabilities
- `match-result-notifications`: detección del resultado del partido del equipo principal del
  usuario, envío Web Push y preferencia de baja.

## Impact

- `Back/ExtractionApi`: dispatcher Web Push, `RffmRoundRefreshPolicy` (se extrae el cálculo del
  fin estimado), nuevo worker + servicio + endpoints en `Features/Federation/MatchResultNotifications/`,
  dos entidades y una migración en `FederationDbContext`.
- `Front/` (solo Coach): página `results` y nuevo `matchResultNotificationService.ts`.
- Fuera de alcance: push de Mobile (Expo), combinaciones no principales, resumen de toda la jornada,
  partidos amistosos o locales (`SportEvent`) y avisos de correcciones del marcador.
