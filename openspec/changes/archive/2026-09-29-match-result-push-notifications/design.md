## Context

- **El equipo del usuario ya se conoce**: `FederationSetting` (esquema `federation`) guarda por
  usuario combinaciones `CompetitionId`/`GroupId`/`TeamId`/`SeasonId`, y una es `IsPrimary`.
  `TeamId` es el código RFFM del equipo (el mismo espacio que `LocalTeamCode`/`VisitorTeamCode` de
  `RffmMatch`). `usePrimaryTeam` → `MatchCard` lo usa para resaltar el partido propio en
  Calendario, Jornada y Resultados.
- Los resultados viven en `FederationDbContext` (`RffmCompetitionGroup`, `RffmRound`, `RffmMatch`).
  `IRffmResultsSyncService` solo pide a la RFFM lo que dicta `RffmRoundRefreshPolicy`: para un
  partido que ya ha podido terminar sin acta cerrada, como mucho una vez cada 10 min. Hoy ese
  refresco solo ocurre cuando alguien abre Resultados/Calendario/Clasificación.
- La Web Push de la SPA ya existe: `IWebPushNotificationDispatcher` (en `AppDbContext`: persiste un
  `Notification` por destinatario y hace envío best-effort; si falla, nunca rompe a quien lo llama),
  `WebPushSubscriptions`, la campana y la página de notificaciones.
- Hay patrón `BackgroundService` con scope por iteración (`RffmResultsWorker`, `SquadHistoryWorker`)
  e infraestructura de tests con Postgres real (`PostgresContainerFixture`, `FakeRffmResultsClient`).

## Goals / Non-Goals

**Goals:** avisar por Web Push, una vez, a cada usuario cuando se publique el marcador del partido
de liga de su equipo principal; que pueda darse de baja desde Resultados; no multiplicar las
llamadas a la RFFM.

**Non-Goals:** push de Mobile (Expo), combinaciones no principales, resumen de toda la jornada,
`SportEvent` locales/amistosos, avisos de correcciones del marcador y marcador en directo.

## Decisions

### D1 · «Su equipo» = combinación principal de la temporada actual

Destinatarios candidatos: `FederationSetting` con `IsPrimary = true`, `TeamId` y `GroupId`
informados y `SeasonId` igual a `RffmOptions.CurrentSeasonId` (o `null`, tratado como la actual,
igual que en el front). Es el mismo criterio con el que se resalta el partido en pantalla, así que el
usuario recibe exactamente el partido que ve marcado. Si un usuario tuviera varias principales
(dato sucio), se toma la de `CreatedAt` más reciente.

### D2 · Preferencia y registro de envíos (`FederationDbContext`)

`Domain/Entities/Federation/MatchResultNotifications/`:

```csharp
public class MatchResultNotificationOptOut : BaseEntity   // único UserId
{ string UserId; DateTime CreatedAt; static Create(userId, now); }

public class MatchResultNotificationLog : BaseEntity      // único (UserId, RecordCode)
{ string UserId; string RecordCode; string TeamCode; string LocalGoals; string VisitorGoals;
  DateTime NotifiedAt; static Create(...); }
```

- **Activado por defecto**: solo se guarda la baja. La preferencia es por usuario (su equipo es
  uno: el principal).
- El log garantiza un único aviso por (usuario, partido) aunque haya reinicios, el worker se solape
  o el usuario cambie de equipo principal a mitad de jornada. Se inserta **antes** de enviar (como
  mucho una vez): si el envío falla a medias, no se repite. Es el mismo criterio best-effort del
  resto de Web Push.
- Van en `FederationDbContext`, junto a `FederationSetting` y `RffmMatch`, para cruzar con ellos
  en SQL. Solo el `Notification` final va a `AppDbContext`, a través del dispatcher.
- Migración `AddMatchResultNotifications` (dos tablas con sus índices únicos).

### D3 · Endpoints de preferencia (`Features/Federation/MatchResultNotifications/`)

Un archivo por feature (vertical slice), ambos con `RequireAuthorization()` y el usuario de
`ICurrentUserService`:

- `GetMatchResultNotificationPreference.cs`: `GET /api/match-result-notifications/preference` →
  `200 { enabled: bool, teamName: string? }`. `teamName` es el `TeamName` de la combinación
  principal vigente (`null` si no tiene) y sirve para el texto del interruptor. Query
  `IRequest<…>` (no `IQueryApp`: depende del usuario y no debe cachearse).
- `UpdateMatchResultNotificationPreference.cs`: `PUT /api/match-result-notifications/preference`
  body `{ enabled }` → `204`. Command + Validator (`Enabled` obligatorio: `bool?` con `NotNull()`).
  Es idempotente: `enabled=false` crea la baja si no existe y `enabled=true` la borra si existe.

### D4 · Detección (`MatchResultNotificationService` + `MatchResultNotificationWorker`)

`MatchResultNotificationWorker : BackgroundService`: un `PeriodicTimer` con
`RffmOptions.Results.ResultNotificationPollMinutes` (5 por defecto) y un scope por tick que llama a
`IMatchResultNotificationService.RunAsync(ct)`. Cada excepción se registra y el worker sigue (mismo
patrón que `RffmResultsWorker`).

`RunAsync`:

1. Carga las combinaciones principales vigentes (D1) de usuarios sin baja y las agrupa por
   `GroupId` → conjunto de `TeamId` → usuarios.
2. Por grupo, carga de BD el grupo y sus jornadas con partidos. Si el grupo aún no está guardado,
   llama una vez a `IRffmResultsSyncService.GetCalendarAsync(groupId, CurrentSeasonId)` para
   crearlo.
3. **Candidatos**: partidos cuyo `LocalTeamCode` o `VisitorTeamCode` está en el conjunto y que están
   en la ventana de notificación:
   - con horario: `estimatedEnd ≤ now` y `now − estimatedEnd ≤ ResultNotificationWindowHours`
     (48 h por defecto);
   - sin hora: `MatchDate` entre hoy−2 días y hoy (hora de Madrid).

   La ventana evita avisar de partidos antiguos cuando un usuario guarda su equipo por primera vez
   o tras una caída larga. `estimatedEnd` sale de un nuevo helper público
   `RffmRoundRefreshPolicy.EstimatedEndUtc(match, minutes, parts, settings)`, extraído de
   `Evaluate` para no duplicar el cálculo.
4. Por cada jornada con algún candidato **sin marcador**, llama a
   `IRffmResultsSyncService.GetMatchDayAsync(groupId, round, CurrentSeasonId)`. La política decide
   si de verdad se llama a la RFFM (como mucho cada 10 min por jornada, compartido con el camino
   interactivo). Después se vuelven a leer los partidos.
5. **Marcador publicado** = `LocalGoals` y `VisitorGoals` parsean a `int`, el mismo criterio que
   `GetTeamNextMatch.IsPlayed`. No se exige `IsFinal`, para avisar cuanto antes.
6. Por cada (usuario, partido) con marcador y sin log: inserta los logs, `SaveChanges` (si choca
   con el índice único, otro proceso ya lo ha enviado: se ignora) y `DispatchMatchResultAsync` con
   los usuarios de cada (equipo, partido).

Un fallo en un grupo (RFFM caída, etc.) se registra y el resto de grupos sigue.

### D5 · Envío (`IWebPushNotificationDispatcher.DispatchMatchResultAsync`)

```csharp
Task DispatchMatchResultAsync(IReadOnlyCollection<string> userIds, MatchResultMessage message,
    CancellationToken ct = default);
public record MatchResultMessage(int Round, string LocalTeamName, string LocalGoals,
    string VisitorTeamName, string VisitorGoals, bool IsLocal);
```

- `Type = "MatchResult"`, título `Resultado · Jornada {Round}`, cuerpo
  `{Local} {LG} - {VG} {Visitante}` precedido de `Victoria:`/`Empate:`/`Derrota:` desde el punto de
  vista del equipo, y deep link `/coach/results`.
- Usa el `DispatchToUsersAsync` existente: `Notification` para todos (se ve en la campana aunque el
  usuario no tenga el navegador suscrito) y Web Push para quien tenga suscripción. Va envuelto en
  `try/catch` con warning, como los demás métodos.

### D6 · Frontend (Coach)

- `matchResultNotificationService.ts`: `getPreference()` → `{ enabled, teamName }` y
  `setPreference(enabled)`.
- Resultados: nuevo `components/MatchResultNotificationsToggle.tsx` (+ `.module.css`), un `Switch`
  «Notificarme los resultados de {teamName}» debajo de la cabecera.
  - Sin equipo principal (`teamName = null`): en lugar del switch, el aviso «Guarda tu equipo en
    Ajustes para recibir sus resultados», con enlace a los ajustes de federación.
  - Sin suscripción push en el navegador (se reutiliza `usePushActivationStatus`): texto de ayuda
    con enlace a Ajustes > Notificaciones.
  - Cambio optimista; si el `PUT` falla, se revierte y se avisa con `rffm.show_snackbar`.
- Mobile-first, sin tablas, CSS Modules y tema Coach.

## Risks / Trade-offs

- **Cuándo publica la RFFM los goles**: en la temporada 21 los goles llegaban con el acta cerrada.
  Si la RFFM no publica marcador provisional, el aviso llegará al cerrarse el acta (normalmente la
  misma tarde, a veces días después). No se puede verificar hasta que se juegue una jornada; queda
  como punto a vigilar, igual que en `persist-rffm-results`.
- **El equipo de Resultados (Coach) puede no ser el principal**: la página de Resultados de Coach
  muestra el grupo del `Team` seleccionado, pero el aviso sigue a la combinación principal (la misma
  que resalta el partido). Por eso el interruptor nombra el equipo al que se refiere.
- **Carga en la RFFM**: el worker solo provoca peticiones para jornadas con partidos seguidos
  pendientes de marcador, y siempre a través de la política (≤ 1 cada 10 min por jornada, ≤ 1 cada
  24 h tras 48 h).
- **Corrección del marcador**: si la RFFM cambia el resultado después del aviso, no se reenvía.
- **Una sola instancia**: el índice único del log evita duplicados aunque haya dos instancias.
- **Dos contextos**: la detección y el log van en `FederationDbContext`, y el `Notification` en
  `AppDbContext`. No hay transacción común; con log-antes-de-enviar, el peor caso es un aviso
  perdido, nunca uno duplicado.

## Migration Plan

Migración `AddMatchResultNotifications` sobre `FederationDbContext`, en un commit separado del
código. No hay backfill. Gracias a la ventana de 48 h, el primer arranque solo avisa de partidos
recientes. Rollback: revertir la migración y el registro del worker.
