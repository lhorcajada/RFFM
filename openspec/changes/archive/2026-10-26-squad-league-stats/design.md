## Context

`GetSeasonPlayerStats` agrega `MatchParticipations` con `MatchPhase == "finished"` sin mirar el tipo de
evento. `GetTeamPlayerStatistics` ya conoce el tipo de evento de cada participación
(`SportEvents.EventTypeId`, liga = `SportEventsConstants.MatchEventTypeId`) y cuenta tarjetas con
`PlayerCardCountService.CountCards(cardsJson, teamPlayerId, "Yellow"|"Red")`. `PlayerCromo` pinta hoy
`seasonStats` (minutos, goles, titularidades) solo si `totalMatches > 0`.

## Goals / Non-Goals

**Goals:** cifras de liga fiables y etiquetadas; no mezclar liga con amistosos/torneos.

**Non-Goals:** tocar `season-stats`, rediseñar el cromo o la cabecera, cambiar `Mobile/`.

## Decisions

### D1 · Endpoint nuevo, no modificar `season-stats`
`season-stats` alimenta otros consumidores con semántica «todos los partidos»; cambiarla rompería el
contrato. Se crea `GetLeaguePlayerStats` (un archivo, vertical slice) con
`LeaguePlayerStatsDto(TeamPlayerId, Goals, CallUps, Starts, YellowCards, RedCards, MinutesPlayed)`.

### D2 · Qué cuenta como «liga»
Participaciones terminadas (`MatchPhase == "finished"`) cuyo `EventId` pertenece a un `SportEvent` del
equipo con `EventTypeId == MatchEventTypeId`. Goles con la misma lógica que `season-stats`
(`isOwnTeam` y `scorerId`); tarjetas con `PlayerCardCountService`; titularidades = `IsStarter`;
minutos = suma de `MinutesPlayed`.

### D3 · Convocatorias
Número de partidos de liga ya jugados en los que el jugador fue convocado. Se reutiliza la definición de
convocado/asistencia de `GetTeamPlayerStatistics` (`AttendedFor`/`PossibleFor` sobre el tipo liga) en
lugar de inventar otra; la definición exacta se confirma al implementar y se documenta en el código.
Un jugador sin convocatorias devuelve ceros, no se omite.

### D4 · Frontend
- `getTeamLeagueStats(teamId)` en un servicio nuevo `leagueStatsService.ts`; en error devuelve `[]`
  (igual que `getSeasonPlayerStats`).
- `Squad.tsx` lo carga junto a las demás cargas no bloqueantes y lo pasa a `PlayerCromo` con la misma
  condición de visibilidad que `seasonStats`.
- `PlayerCromo`: prop nueva `leagueStats`; sustituye `seasonStats` (se elimina la prop y su fila).
  Bloque con etiqueta «Solo liga» y seis casillas (Goles, Convocatorias, Titular, Amarillas, Rojas,
  Minutos); se muestra aunque todo sea 0 si hay dato de liga.
- Aviso informativo propio encima de la lista, solo cuando se muestran cifras.
- Estilos con CSS Modules; los ámbar del aviso se añaden como variables en `:root` de `muiGameTheme`
  (el tema del entrenador no se monta), previa aprobación del usuario.

## Risks / Trade-offs

- Quitar la fila de temporada cambia lo que ve el usuario (ya no suma amistosos): es la petición.
- Una consulta más al cargar la plantilla; es no bloqueante y barata (una pasada por equipo).
