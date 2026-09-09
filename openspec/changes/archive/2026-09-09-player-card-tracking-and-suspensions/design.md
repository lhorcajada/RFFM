# Design: Acumulado de tarjetas, historial de sustituciones y sanción automática

## Contexto (estado actual verificado en código)

- `MatchParticipation` (`Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/
  MatchParticipation.cs`) ya persiste `CardsJson` (array de `{ id, minute, half, cardType,
  teamPlayerId, playerName, isRivalPlayer, rivalDorsal }`, `cardType` en minúscula
  `"yellow"|"red"`) y `SubstitutionWindowsJson` (array de `SubstitutionWindow { windowIndex,
  minute, half, swaps: [{ inPlayerId, outPlayerId, slotIndex }], slotsAfter, isHalftime }`),
  además de `EnteredAtMinute`/`ExitedAtMinute` (una sola entrada/salida, ya insuficiente).
- `GetPlayerMatchHistory.cs` (`GET /api/catalog/team-player/{id}/match-history`) es el único
  endpoint que alimenta la pestaña Estadísticas de `PlayerDetail.tsx`. Los totales del resumen
  (minutos, goles, titularidades) ya se calculan **en el frontend** sumando el array devuelto —
  no hay un endpoint de agregados aparte para esta pantalla. Seguimos ese mismo patrón para
  amarillas/rojas: el backend expone el dato por partido, el frontend suma.
- `TeamPlayerSanction` (`Domain/Entities/TeamPlayers/TeamPlayerSanction.cs`) ya soporta
  creación/edición/fin manual vía `SetPlayerSanction.cs` y se renderiza en
  `Front/src/apps/coach/pages/sanctions/Sanctions.tsx`. No tiene noción de "automática" ni de
  multa.
- `AddConvocations.cs` crea convocatorias sin ninguna validación de sanción.

## Decisión 1 — Extender `PlayerMatchRecordDto` (no crear endpoint nuevo)

`GetPlayerMatchHistory.PlayerMatchRecordDto` gana:

```csharp
public record PlayerMatchRecordDto(
    string EventId,
    int MinutesPlayed,
    bool IsStarter,
    int? EnteredAtMinute,     // se mantiene por compatibilidad, ya no se pinta en la tabla
    int? ExitedAtMinute,      // ídem
    int GoalsScored,
    int YellowCards,          // nuevo
    int RedCards,             // nuevo
    string? RivalName,        // nuevo — SportEvent.Rival?.Name
    int EventTypeId,          // nuevo — SportEvent.EventTypeId
    string EventTypeName,     // nuevo — SportEventType.FromId(EventTypeId).Name
    List<SubstitutionWindowRecordDto> SubstitutionWindows, // nuevo
    int ScoreLocal,
    int ScoreVisitor,
    DateTime SavedAt);

public record SubstitutionWindowRecordDto(int WindowIndex, int Minute, int Half, List<SubstitutionSwapRecordDto> Swaps);
public record SubstitutionSwapRecordDto(string InPlayerId, string? OutPlayerId, int SlotIndex);
```

- `YellowCards`/`RedCards`: mismo `CountCards(mp.CardsJson, mp.TeamPlayerId, "yellow"|"red")`
  que ya existe en `GetPlayerSeasonCards.cs` (comparación case-insensitive), duplicado aquí como
  helper privado — sigue el patrón ya establecido de duplicar este parseo por archivo
  (`GetSeasonPlayerStats`, `GetPlayerMatchHistory`, `GetPlayerSeasonCards` ya lo hacen cada uno
  por su lado).
- `SubstitutionWindows`: `JsonSerializer.Deserialize<List<SubstitutionWindowRecordDto>>
  (mp.SubstitutionWindowsJson)`, `catch → []` igual que el resto de parseos de este archivo.
- El join a `SportEvent`/`Rival`/`SportEventType` se hace con una consulta adicional
  (`_db.SportEvents.Where(se => eventIds.Contains(se.Id)).Include(se => se.Rival)`) sobre los
  `EventId` distintos del historial, para no cambiar el `AsNoTracking()` de
  `MatchParticipations` a un `Include` cruzado innecesario.

## Decisión 2 — Contador histórico vs. contador cíclico de amarillas

No se persiste ningún contador: **se deriva siempre** de `CardsJson` a través de todas las
`MatchParticipation` `finished` del jugador en partidos de tipo `"Partido"` (mismo filtro que
`GetPlayerSeasonCards` usa para "matches", excluyendo amistosos/torneos de la disciplina
federativa), igual que ya se hace para goles/minutos. Esto evita divergencias cuando el coach
edita un partido ya finalizado (`edit-finished-match-goals-cards`).

- **Histórico total** = suma de amarillas en *todas* las participaciones `finished` de tipo
  `"Partido"` del jugador, sin límite temporal.
- **Cíclico (0→5)** = suma de amarillas en las participaciones `finished` de tipo `"Partido"`
  cuya `SportEvent.EveDateTime` es **posterior** a la `StartDate` de la sanción automática de
  tipo "5 amarillas" más reciente del jugador (si no hay ninguna, es igual al histórico).
  Alcanzar 5 en este cómputo es lo que dispara la sanción; en el instante en que se crea la
  sanción automática, el propio cómputo cíclico "se reinicia" porque a partir de ahí ya cuenta
  solo partidos posteriores a esa `StartDate`.

Esta lógica vive en un helper nuevo y compartido:
`Features/Coaches/Players/Services/PlayerCardCountService.cs` (clase estática), usado por:
1. `GetPlayerMatchHistory` (columna "Tarjetas" por partido — cuenta simple del partido).
2. `SaveMatchParticipation.Handler` (detección de sanción, Decisión 3).

Firma:
```csharp
public static class PlayerCardCountService
{
    public static int CountHistoricalYellowCards(IEnumerable<MatchParticipation> matchTypeFinishedParticipations, string teamPlayerId);
    public static int CountCyclicYellowCards(IEnumerable<(MatchParticipation Participation, DateTime? EventDate)> matchTypeFinishedParticipations, string teamPlayerId, DateTime? sinceExclusive);
    public static bool HasRedCard(string? cardsJson, string teamPlayerId);
}
```

## Decisión 3 — Sanción automática al guardar un partido finalizado

En `SaveMatchParticipation.Handler.Handle`, **después** del `SaveChangesAsync` existente (para
tener IDs/estado consistente) y solo cuando `request.MatchPhase == "finished"` y el
`SportEvent.EventTypeId == SportEventType.Match.Id`:

Para cada jugador de `request.Players`:
1. Si `PlayerCardCountService.HasRedCard(dto's CardsJson slice, teamPlayerId)` → candidato a
   sanción por roja.
2. Si el cómputo cíclico (Decisión 2) `>= 5` → candidato a sanción por 5 amarillas.
3. **Idempotencia**: antes de crear, comprobar que no existe ya una `TeamPlayerSanction` con
   `SourceEventId == request.EventId && IsAutomatic == true` para ese jugador y ese motivo (para
   que reeditar/regrabar el mismo partido no duplique sanciones).
4. Crear `TeamPlayerSanction.CreateAutomatic(...)` (nuevo factory method) con:
   - `Category = SanctionCategory.Competition`
   - `SanctionType = "Amarillas acumuladas (5)"` o `"Tarjeta roja"`
   - `Description` autogenerada: `"Generada automáticamente: 5ª tarjeta amarilla en el partido
     del {fecha} vs {rival}."` / `"Generada automáticamente: expulsión (tarjeta roja) en el
     partido del {fecha} vs {rival}."`
   - `StartDate = SportEvent.EveDateTime ?? DateTime.UtcNow`
   - `IsAutomatic = true`, `Fine = null`, `SourceEventId = request.EventId`
   - `EndDate = null` (activa)

**Nuevos campos en `TeamPlayerSanction`** (migración `AddAutomaticSanctionFields`, esquema
`app`):
```csharp
public bool IsAutomatic { get; private set; }
public decimal? Fine { get; private set; }
public string? SourceEventId { get; private set; }
```
`Update(...)` gana un parámetro opcional `decimal? fine` (el coach puede añadir/editar la multa
desde `Sanctions.tsx`; `IsAutomatic`/`SourceEventId` no son editables una vez creados).

## Decisión 4 — Bloqueo de convocatoria

En `AddConvocations.AddConvocationHandler.Handle`, tras cargar `sportEvent` y antes de crear el
`Convocation`:

```csharp
var activeSanction = await _db.TeamPlayerSanctions
    .Where(s => s.TeamPlayerId == request.TeamPlayerId && s.IsAutomatic && s.EndDate == null)
    .OrderByDescending(s => s.StartDate)
    .FirstOrDefaultAsync(cancellationToken);

if (activeSanction is not null && sportEvent.EveDateTime > activeSanction.StartDate)
    throw new ArgumentException(
        $"El jugador está sancionado ({activeSanction.SanctionType}) y no puede ser convocado " +
        "hasta que el entrenador levante la sanción.");
```

Reutiliza el `catch (ArgumentException)`/mapeo a 400 ya existente en este endpoint (no hay
middleware nuevo que crear). `BulkAddConvocationHandler` (convocar a todo el equipo) **no**
lanza excepción — simplemente omite a los jugadores con sanción activa, igual que ya omite a
los ya convocados (`existing`), porque es un "convocar a todos los disponibles", no una acción
explícita sobre un jugador concreto.

La sanción se "cumple" cuando el coach la levanta manualmente desde `Sanctions.tsx` (botón
"Levantar sanción" ya existente, sin cambios) — no hay vínculo automático con un partido
concreto (ver Non-goals de `proposal.md`).

## Decisión 5 — Frontend: pestaña Estadísticas (`PlayerDetail.tsx`)

- `PlayerMatchRecord` (`liveMatch.types.ts`) se extiende con los mismos campos de la Decisión 1
  (camelCase): `yellowCards`, `redCards`, `rivalName`, `eventTypeName`,
  `substitutionWindows: SubstitutionWindowRecord[]`.
- Resumen: dos tiles nuevos "amarillas"/"rojas" (`matchHistory.reduce`), mismo patrón que
  `totalMinutes`/`totalGoals`.
- Tabla: se extrae a un componente nuevo `Front/src/apps/coach/pages/player/components/
  PlayerMatchHistoryTable.tsx` (el bloque actual ya supera las 70 líneas dentro de
  `PlayerDetail.tsx` y va a crecer con la fila expandible — coherente con "Específico de una
  página → junto a la página" de `react.md`).
  - Columnas: Fecha guardado, Rival, Tipo, Marcador, Min, Titular, Tarjetas (chips 🟨/🟥ount),
    Goles, y una celda de expansión (`IconButton` + `KeyboardArrowDown/Up`, patrón MUI
    "collapsible table").
  - Fila hija (`Collapse` + `TableRow` anidada) muestra la lista de entradas/salidas del
    jugador para ese partido, calculada por una función pura nueva y testeada aisladamente:
    `derivePlayerStints(record: PlayerMatchRecord, teamPlayerId: string): PlayerStint[]`
    (`PlayerStint = { enteredAtMinute: number; exitedAtMinute: number | null }`), en un archivo
    `playerMatchStints.ts` junto al componente. Algoritmo: recorre `substitutionWindows`
    ordenadas por `minute`; si `isStarter`, el primer stint arranca en minuto 0; cada
    `swaps` con `inPlayerId === teamPlayerId` abre un stint en `window.minute`; cada `swaps`
    con `outPlayerId === teamPlayerId` cierra el stint abierto en `window.minute`; si al final
    queda un stint abierto, `exitedAtMinute = null` (sigue en el campo / partido acabó con él
    dentro).

## Decisión 6 — Frontend: `Sanctions.tsx`

- `SanctionRecord` (`teamplayerSanctionService.ts`) gana `isAutomatic: boolean`, `fine: number |
  null`. `createPlayerSanction`/`updatePlayerSanction` payloads ganan `fine?: number | null`.
- Tabla: nueva columna "Multa" (`fine != null ? `${fine} €` : "—"`); chip "Automática" junto al
  `sanctionType` cuando `isAutomatic`.
- Diálogos Add/Edit: `TextField` numérico "Multa (€)" opcional (el Add dialog lo incluye por
  simetría aunque las sanciones creadas manualmente también puedan llevar multa).
- El diálogo de edición sigue siendo el único punto donde se edita `description`/`fine` de una
  sanción automática — no se permite editar `sanctionType`/`isAutomatic`/`sourceEventId` cuando
  `isAutomatic === true` (deshabilitar ese campo en el formulario), para no perder la
  trazabilidad del motivo autogenerado.

## Decisión 7 — Frontend: aviso de bloqueo al convocar

`useConvocationManagement.ts` ya captura errores de `convocationService.addConvocation(...)` en
un `catch (err: any)` puntual (línea ~495, `setMgmtSaveResult(err?.message ?? "error")`). Se
generaliza ese mismo patrón a los demás `catch {}` silenciosos que llaman a `addConvocation`
(líneas ~397 y ~516): capturar el mensaje RFC7807 (`e.response?.data?.detail ?? e.message`) y
emitirlo vía el bus de eventos existente `rffm.show_snackbar` (severity `"error"`), en vez de
tragarlo. No se crea UI nueva — solo se deja de silenciar el error ya devuelto por el backend.

## Non-goals reiterados
- Sin vínculo automático sanción↔partido concreto que la "cumple".
- Sin sincronización con sanciones federativas.

## Decisiones confirmadas con el usuario
- Solo las amarillas/rojas de partidos de tipo `"Partido"` (liga) cuentan para el contador
  cíclico y disparan sanción automática; amistosos y torneos quedan excluidos (Decisiones 2 y
  3, filtro `EventTypeId == SportEventType.Match.Id`).
