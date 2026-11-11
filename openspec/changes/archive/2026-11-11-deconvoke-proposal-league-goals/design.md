## Context

- `goalsRule` puntúa `seasonPlayerStats.totalGoals × 2` y etiqueta el factor "Goles (temporada)" (verificado en `goalsRule.ts`).
- `seasonStats` llega de `getSeasonPlayerStats(teamId)` → `GetSeasonPlayerStats.cs`, que agrega todas las `MatchParticipation` con `MatchPhase == "finished"` del equipo, sin filtrar por tipo de evento. Cuenta, por tanto, amistosos y torneos (verificado).
- `useConvocationMatchContext.ts` sobrescribe `totalGoals` con los goleadores RFFM (`getTeamGoleadores`) solo si hay goleadores y el jugador casa por `playerId` o nombre. Si no casa, mantiene el valor del backend (`return s`), con goles de amistosos (verificado).
- `GetLeaguePlayerStats.cs` ya filtra por `SportEventsConstants.MatchEventTypeId` (= 1, "Partido") uniendo `MatchParticipation.EventId` con `SportEvents`, y separa una agregación pura (`Calculator`) testeable sin base de datos (verificado).
- `GetTeamPlayerStatistics` y `GetPlayerSeasonCards` replican la lógica de `GetSeasonPlayerStats` y deben seguir igual (decisión del usuario: solo cambia la propuesta).

## Goals / Non-Goals

Goals:
- La regla de goles de la propuesta de desconvocados usa solo goles de partidos de liga.
- El factor se muestra como "Goles (liga)".
- El criterio "tipo liga" es una constante del backend, no una búsqueda por texto.

Non-goals:
- Cambiar `totalGoals` ni sus consumidores (estadísticas, fichas, Mobile).
- Cambiar el peso por gol (2 puntos) ni otras reglas de la propuesta.
- Tratar copas o torneos como liga: quedan fuera.
- Reemplazar el criterio por nombre del hook para clasificar `seasonEvents`.

## Decisions

### D1. Campo nuevo `LeagueGoals` en `PlayerSeasonStatsDto`
Se añade `LeagueGoals` al final del record junto a `TotalGoals`, que se mantiene. Alternativas: (a) filtrar `TotalGoals` por liga — descartada, cambia el significado para todos los consumidores; (b) calcular en el front — descartada, el front no tiene el tipo de evento por participación. Consecuencia: cambio aditivo, sin romper clientes.

### D2. Filtro por `SportEventsConstants.MatchEventTypeId` vía `SportEvents`
El handler obtiene los ids de evento del equipo con `EventTypeId == MatchEventTypeId` y calcula `LeagueGoals` solo con las participaciones cuyo `EventId` está en ese conjunto. `TotalMinutes`, `TotalStarts`, `TotalMatches` y `TotalGoals` siguen usando todas las participaciones. Sigue el precedente de `GetLeaguePlayerStats`. No se exige que el evento esté en el pasado: `MatchPhase == "finished"` ya lo garantiza.

### D3. Agregación pura testeable
Como `GetLeaguePlayerStats`, la agregación pasa a un `Calculator` estático que recibe filas de participación con un indicador `IsLeague` y devuelve los DTOs, para probarla sin base de datos.

### D4. Front: `leagueGoals` como campo propio
`SeasonPlayerStats` gana `leagueGoals: number`. La fusión con goleadores RFFM escribe `leagueGoals`; en la rama sin `seasonStats` del backend, `leagueGoals` es el valor RFFM (o 0). `totalGoals` ya no lo toca la fusión. Un jugador no casado en RFFM conserva el `leagueGoals` del backend. Consecuencia: el fallo de arrastrar amistosos desaparece aunque RFFM no responda.

### D5. `goalsRule` y etiqueta
`goalsRule` lee `leagueGoals` y usa la etiqueta "Goles (liga)". Se mantiene la clave `goals` del factor, de la que dependen los formateadores.

## Target State

La propuesta puntúa goles solo de liga, con prioridad al dato RFFM cuando existe y al dato del backend como respaldo. El resto de pantallas sigue viendo `totalGoals`.

## Risks / Trade-offs

- Un partido de liga guardado con otro `EventTypeId` no contaría: se mitiga usando la constante que ya emplean `GetLeaguePlayerStats` y `UpdateConvocationStatus`.
- Dos fuentes (backend y RFFM) para el mismo dato: se mantiene la prioridad de RFFM existente y se cubre con tests de la fusión.
- Dato duplicado en el DTO: coste despreciable.

## Migration Plan

Not applicable: sin cambios de esquema; campo aditivo en la respuesta. Un front antiguo ignora `leagueGoals`; un front nuevo contra un backend antiguo recibiría `leagueGoals` indefinido, por lo que se despliegan juntos (Back primero) y `goalsRule` trata un valor ausente como 0.

## Validation Strategy

- Back (xUnit): `Calculator` — gol en liga y en amistoso (`LeagueGoals` 2, `TotalGoals` 5), solo amistosos (`LeagueGoals` 0), torneo excluido, goles rivales o de otro jugador no cuentan.
- Front (Vitest): `goalsRule` — usa `leagueGoals`, ignora `totalGoals`, etiqueta "Goles (liga)", ausente = 0.
- Front (Vitest): `useConvocationMatchContext` — goleadores RFFM escriben `leagueGoals`; jugador no casado conserva el valor del backend; `totalGoals` intacto.
- No se requiere base de datos real.

## ADR / DDR Evaluation

Neither. Es un ajuste acotado a una regla de la propuesta; no fija un patrón de arquitectura ni una decisión de dominio duradera.

## Open Questions

None
