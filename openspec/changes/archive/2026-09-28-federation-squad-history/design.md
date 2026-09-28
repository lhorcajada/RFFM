## Context

- `PlayerService.GetPlayerAsync(playerId, seasonId)` ya parsea la ficha RFFM
  (`/jugador/{id}?temporada=`): `competiciones_participa[]` (competición, grupo, equipo, club,
  `puntos_equipo`, `posicion_equipo`) y totales de temporada (`convocados`, `titular`,
  `total goles`, tarjetas `100/101/102`). Los totales **no** están desglosados por equipo.
- `GetTeamCallups` ya deriva convocado/titular de las actas (`jugadores_equipo_local/visitante`,
  `titular`), y `MatchRffm` expone goles (`goles_equipo_*`, `codjugador`) y tarjetas
  (`tarjetas_equipo_*`, `codigo_tipo_amonestacion`).
- No hay reintentos (`AddHttpClient()` sin políticas; `HtmlFetcher` traga errores) ni
  infraestructura de trabajos en segundo plano.
- `Notification` (AppDbContext) + `GET /api/notifications` + `POST /api/notifications/{id}/read`
  existen y filtran por el usuario autenticado; solo Coach tiene UI.
- Temporadas: `RffmOptions.SelectableSeasons` (ordenadas desc: 22, 21, 20…).

## Goals / Non-Goals

**Goals:** informe persistido por (equipo, temporada); generación en segundo plano, robusta frente a
errores de red y reinicios; carga mínima y espaciada sobre la RFFM; notificación in-app.

**Non-Goals:** web push en Federación; cambiar los clientes HTTP interactivos; >2 temporadas.

## Decisions

### D1 · Clave del informe: (TeamCode, SeasonId), compartido entre usuarios
Los datos son públicos de la RFFM; un informe por equipo y temporada (la seleccionada en
Plantilla) evita trabajo duplicado. Quién lo pidió se guarda en `SquadHistorySubscriber` para
notificarle. "Temporada anterior" = siguiente elemento de `SelectableSeasons` tras `SeasonId`
(si no existe, solo se procesa la seleccionada).

### D2 · Modelo (esquema `federation`, `FederationDbContext`)

```csharp
public sealed class SquadHistoryStatus : SmartEnum<SquadHistoryStatus>
{ Pending(1), Running(2), Completed(3), Failed(4) }

public class SquadHistoryReport : BaseEntity           // Id string, como el resto
{
    string TeamCode; string TeamName; int SeasonId; int? PreviousSeasonId;
    SquadHistoryStatus Status; int TotalPlayers; int ProcessedPlayers; int FailedPlayers;
    DateTime RequestedAt; DateTime? StartedAt; DateTime? CompletedAt; string? ErrorMessage;
    IReadOnlyCollection<SquadHistoryEntry> Entries;        // private List<>
    IReadOnlyCollection<SquadHistorySubscriber> Subscribers;

    static SquadHistoryReport Create(teamCode, teamName, seasonId, previousSeasonId, userId);
    void Subscribe(userId);                 // idempotente
    void RequestRefresh(userId);            // Completed|Failed → Pending (+Subscribe); Pending|Running → solo Subscribe
    void Start(int totalPlayers); void ReportProgress(bool playerFailed);
    void Complete(IEnumerable<SquadHistoryEntry> entries);  // reemplaza Entries atómicamente
    void Fail(string reason);
}

public class SquadHistoryEntry
{
    string PlayerCode; string PlayerName; int SeasonId; string SeasonName;
    string CompetitionCode; string CompetitionName; string GroupCode; string GroupName;
    string TeamCode; string TeamName; string ClubName; string? TeamShieldUrl;
    int TeamPoints; int TeamPosition;
    int Goals; int YellowCards; int RedCards;   // RedCards = rojas directas + dobles amarillas
    int? Starts; int? CallUps;                  // null si no se pudo obtener
    SquadHistorySource Source;                  // SmartEnum: PlayerSheet(1), Actas(2)
    bool IsIncomplete;                          // fallo parcial al obtener datos
}

public class SquadHistorySubscriber { string ReportId; string UserId; bool Notified; }
```

Índice único `(TeamCode, SeasonId)` en `SquadHistoryReports`. Los datos viejos siguen visibles
mientras se actualiza porque `Complete` solo reemplaza `Entries` al terminar.

### D3 · Cola y worker
- `ISquadHistoryQueue` sobre `Channel<string>` (unbounded, `SingleReader = true`), singleton.
- `SquadHistoryWorker : BackgroundService`: al arrancar reencola los informes `Pending`/`Running`
  (se recuperan tras un reinicio). Consume de uno en uno y crea un scope por informe
  (DbContext scoped). Una excepción no controlada lleva a `Fail(...)` y a una notificación de
  error; el worker nunca muere.
- `SquadHistoryGenerator` (scoped) contiene la orquestación y es testeable sin el worker.

### D4 · Acceso a la RFFM: cliente resiliente y con throttling
Cliente con nombre `"RffmBackground"` registrado con `Microsoft.Extensions.Http.Resilience`
(paquete nuevo, justificado por el requisito de reintentos):

```csharp
services.AddTransient<RffmThrottlingHandler>();
services.AddHttpClient("RffmBackground", c => { c.BaseAddress = new("https://www.rffm.es/"); /* UA navegador */ })
    .AddResilienceHandler("rffm", b =>
    {
        b.AddRetry(new HttpRetryStrategyOptions {
            MaxRetryAttempts = 4, BackoffType = DelayBackoffType.Exponential,
            Delay = TimeSpan.FromSeconds(2), UseJitter = true, ShouldRetryAfterHeader = true });  // 408/429/5xx/HttpRequestException
        b.AddCircuitBreaker(new HttpCircuitBreakerStrategyOptions {
            FailureRatio = 0.5, MinimumThroughput = 10, SamplingDuration = TimeSpan.FromSeconds(60),
            BreakDuration = TimeSpan.FromSeconds(60) });
        b.AddTimeout(TimeSpan.FromSeconds(20));             // por intento
    })
    .AddHttpMessageHandler<RffmThrottlingHandler>();     // interior a la resiliencia: cada intento real (también los reintentos) espera turno
```

- `RffmThrottlingHandler` (singleton state): `SemaphoreSlim(1)` y una pausa mínima configurable
  entre peticiones (`RffmOptions.BackgroundMinDelayMs`, 800 ms por defecto, ±25 % de jitter). Así
  hay una única petición a la vez, espaciada, en todo el proceso de fondo.
- Si el circuito se abre, el generador espera `BreakDuration` y reintenta el jugador una vez; si
  vuelve a fallar, marca el jugador `IsIncomplete` y continúa.
- `IRffmBackgroundClient` (`GetPlayerSheetAsync`, `GetGroupRoundsAsync`, `GetRoundMatchesAsync`,
  `GetActaAsync`, `GetTeamRosterAsync`) usa este cliente y los **parsers extraídos**:
  `PlayerSheetParser` (desde `PlayerService.ParsePlayerData`), `ActaParser` (desde
  `ActaService`). `PlayerService`/`ActaService` pasan a delegar en ellos sin cambiar su
  comportamiento.

### D5 · Algoritmo híbrido (`SquadHistoryGenerator`)
1. Plantilla: roster del equipo (`TeamCode`, `SeasonId`) → códigos de jugador. Si falla, `Fail`.
2. Para cada jugador y temporada ∈ {SeasonId, PreviousSeasonId}: ficha RFFM.
3. `competiciones_participa.Count == 1` → una entrada con los totales de la ficha
   (`Source = PlayerSheet`).
4. `Count > 1` → por cada participación se calcula desde las actas (`Source = Actas`):
   partidos del equipo en su grupo (rondas del calendario, **cache por (grupo, equipo)**) y actas
   de esos partidos con `HasRecords` (**cache por `codacta`**). Convocado = aparece en la
   alineación de su lado; titular = `titular` verdadero; goles = entradas en `goles_equipo_*` con
   su `codjugador`; amarillas `100`; rojas `101` + `102`.
   Las caches viven durante la ejecución del informe (diccionarios del generador), así que los
   compañeros que coincidieron en un equipo reutilizan las mismas actas.
5. Tras cada jugador: `ReportProgress` y guardado (el progreso sobrevive a un reinicio y se ve en
   la UI).
6. Al final: `Complete(entries)`, se crea una `Notification` para cada suscriptor no notificado
   (`Type = "SquadHistoryReady"`, `DeepLinkPath = /federation/squad-history/{teamCode}?seasonId={id}`)
   en `AppDbContext`, y se marca `Notified`. Si ocurre `Fail`, `Type = "SquadHistoryFailed"` con
   el mismo enlace.

La lógica de agregación desde actas (`SquadHistoryActaAggregator`, pura) se testea con actas
fixture, sin red.

### D6 · Endpoints (`Features/Federation/SquadHistory/`, un archivo por feature)
- `RequestSquadHistory.cs`: `POST /teams/{teamCode}/squad-history/requests`
  body `{ seasonId, teamName, refresh }`. `ICommand<SquadHistoryRequestResponse>` + `Validator`.
  - No existe → crea `Pending` y encola → **202** `{ reportId, status: "Pending" }`.
  - `Completed` y `!refresh` → **200** `{ status: "Completed" }` (el front navega).
  - `Pending`/`Running` → suscribe al usuario → **202**, sin encolar de nuevo.
  - `refresh` o `Failed` → `RequestRefresh` y encola → **202**.
- `GetSquadHistory.cs`: `GET /teams/{teamCode}/squad-history?seasonId=` → 200 con estado,
  progreso, `completedAt` y jugadores (entradas agrupadas por jugador → temporada); **404**
  `ProblemDetails` si no existe. Es un `IRequest` normal, **no** `IQueryApp`: el estado cambia y
  no debe cachearse.
- Ambos `RequireAuthorization()`; el `userId` se obtiene de `ICurrentUserService`.

### D7 · Frontend
- `shared/services/notificationService.ts`: se mueve desde `apps/coach/services/` (ahora lo usan
  ambas apps) y se actualizan los imports de Coach.
- `apps/federation/services/squadHistoryService.ts`: `requestSquadHistory`, `getSquadHistory` y
  sus tipos.
- `GetPlayers.tsx`: botón "Historial" en `actionBar`. Con 200/Completed navega a
  `/federation/squad-history/{teamId}?seasonId=`; con 202 muestra la snackbar vía
  `rffm.show_snackbar` ("Estamos recopilando el historial. Te avisaremos con una notificación
  cuando esté listo.").
- `pages/SquadHistory/SquadHistory.tsx` (lazy en `routes.tsx`, ruta `squad-history/:teamCode`):
  - cabecera con equipo, temporadas y "Actualizado el …"; botón "Actualizar" (`refresh: true`);
  - con `Pending`/`Running`: `Alert` informativo con el progreso `ProcessedPlayers/TotalPlayers`;
    se muestran los datos anteriores si existen;
  - con 404: estado vacío con el botón "Generar historial";
  - lista de **tarjetas** por jugador (sin tablas): por temporada, una tarjeta por equipo con
    competición · grupo, club, puntos/posición, goles, amarillas, rojas, titularidades y
    convocatorias; `Chip` "Totales de temporada" / "Desde actas"; "—" si el valor es `null`;
    buscador por nombre. Mobile-first, con CSS Modules y el tema de Federación.
- `AppHeader.tsx`: si `isFederationApp`, campana con `Badge` de no leídas (primera página de
  `searchNotifications`, refrescada cada 60 s y al recuperar el foco). Un `Menu` lista las
  últimas; al hacer clic se marca como leída y se navega a `deepLinkPath`.

### D8 · Categorías por año de nacimiento (`FootballCategory`, dominio)
SmartEnum `FootballCategory` (Alevín, Infantil, Cadete, Juvenil, Senior). Con `Y` = año de inicio
de la temporada destino (de la etiqueta `"2026-2027"` en `SelectableSeasons`):

| Categoría | Años de nacimiento | Categoría inferior |
|---|---|---|
| Alevín | Y-11, Y-10 (2015-2016) | — |
| Infantil | Y-13, Y-12 (2013-2014) | Alevín |
| Cadete | Y-15, Y-14 (2011-2012) | Infantil |
| Juvenil | Y-18 … Y-16 (2008-2010) | Cadete |
| Senior | ≤ Y-19 | Juvenil |

`FootballCategory.TryDetect(text)` busca por palabra clave (sin tildes, mayúsculas) en la categoría
del equipo o el nombre de la competición: `ALEVIN`, `INFANTIL`, `CADETE`, `JUVENIL`; `BENJAMIN`,
`PREBENJAMIN`, `VETERANO` → no soportada (no se buscan candidatos); cualquier otro texto → Senior.
`IsFemale(text)` = contiene `FEMENINO`.

### D9 · Búsqueda de posibles jugadores (`SquadCandidateFinder`)
Se activa solo si la ficha del equipo se obtiene pero `jugadores_equipo` está vacío.
1. Contexto de la ficha del equipo destino: `ClubCode`, `ClubName`, `Category` (+ nombre del equipo)
   → categoría destino y femenino/no femenino. Sin club, categoría no soportada o sin temporada
   anterior → el informe se completa vacío con `CandidateSearchNote` explicativa.
> Verificado en vivo el 28/09: `fichaequipo` y `fichaclub` **ignoran `temporada`** y devuelven
> siempre la temporada en curso (los códigos de equipo se mantienen entre temporadas). Al empezar
> la temporada la RFFM vacía las plantillas, así que la de la temporada anterior no puede salir de
> `fichaequipo`: se reconstruye con actas.

2. Equipos del club (códigos): `fichaclub/{club}` (`ClubSheetParser`), filtrando los de la
   categoría destino y su inferior (mismo sexo). Si la ficha falla o no devuelve equipos, se
   identifican por nombre (nombre normalizado del equipo empieza por el del club).
3. Grupo de cada equipo en la temporada anterior: `api/competitions?temporada={anterior}` →
   competiciones de una categoría origen y mismo sexo → `api/groups` → jornada 1 de cada grupo
   (`api/results`) → equipos del club (por código, o por nombre en el respaldo). Con códigos de la
   ficha, la búsqueda para en cuanto aparecen todos.
4. Jugadores de cada equipo origen: sus **2 últimas actas** del grupo (recorriendo jornadas desde la
   última, `GetTeamLastPlayedMatchesAsync`), alineación local o visitante, sin duplicar. Un acta que
   falla se ignora.
5. Ficha de cada jugador en la temporada anterior → `anio_nacimiento`. Se queda con los que
   entran en los años de la categoría destino. La ficha se reutiliza para el historial (no se pide
   dos veces). Se guarda `OriginTeamName`.
6. El historial de los candidatos se construye igual que el de una plantilla normal.

El informe guarda `IsCandidateSquad = true`; `Start()` lo reinicia, de modo que al actualizar un
equipo que ya tiene jugadores se vuelve al modo normal. Cada entrada guarda `BirthYear` (de
cualquier ficha del jugador) y `OriginTeamName` (solo candidatos).

**Volumen**: 1 ficha de club + 1 + nº competiciones origen + grupos recorridos hasta encontrar los
equipos + por equipo (~2-3 jornadas + 2 actas) + nº jugadores. Del orden de 100-200 peticiones
espaciadas (varios minutos); sin ficha de club se recorren todos los grupos. Un jugador que no jugó
esas dos últimas jornadas no se propone (aceptado por el usuario).

## Risks / Trade-offs

- **Ficha del club**: el 28/09 respondió una vez 504 tras 60 s, y no respeta `temporada` (lista
  los equipos actuales). Por eso existe el respaldo por nombre. Emparejar por nombre de club puede
  incluir u omitir equipos con nombres atípicos. Un equipo nuevo de esta temporada no aparece en
  la anterior y obliga a recorrer todos los grupos.

- **Coste**: con 20 jugadores × 2 temporadas se hacen unas 40 fichas; en los casos con varios
  equipos, unas 30 rondas + ~15 actas por equipo nuevo, a 0,8 s o más cada una. Un informe puede
  tardar varios minutos, y eso es aceptable porque se ejecuta en segundo plano. La cache por
  informe reduce mucho el coste cuando varios jugadores vienen del mismo equipo.
- **Scraping frágil** (`__NEXT_DATA__`): los parsers se aíslan y se testean con fixtures; un
  fallo marca la entrada `IsIncomplete` en lugar de abortar el informe.
- **Instancia única**: la cola es en memoria. Con varias instancias podría procesarse el mismo
  informe dos veces; se mitiga con un cambio de estado condicional `Pending→Running` (el
  `UPDATE` comprueba el estado). Hoy el despliegue es de una sola instancia.
- **Badge de no leídas aproximado**: se calcula sobre la primera página (máx. 20). Es aceptable;
  un endpoint de recuento queda fuera de alcance.

## Migration Plan

Migración `AddSquadHistory` sobre `FederationDbContext` (tres tablas + índice único), en un commit
separado. Rollback: revertir la migración; no hay datos previos afectados.
