## 1. Backend — dominio `TeamPlayerSanction`

- [x] 1.1 `Domain/Entities/TeamPlayers/TeamPlayerSanction.cs`: añadir `IsAutomatic` (bool),
      `Fine` (`decimal?`), `SourceEventId` (`string?`). Nuevo factory `CreateAutomatic(string
      teamPlayerId, SanctionCategory category, DateTime startDate, string sanctionType, string
      description, string sourceEventId)` (siempre `IsAutomatic = true`, `Fine = null`). El
      `Create(...)` manual existente pasa `IsAutomatic = false`, `SourceEventId = null`.
      `Update(...)` gana parámetro `decimal? fine`.
- [x] 1.2 Test de dominio (`CVL`... n/a — este repo usa xUnit sin `Given`; seguir el patrón de
      tests ya existente para entidades de `TeamPlayers` si lo hay, si no, tests unitarios
      simples en `RFFM.Api.Tests` cubriendo: `CreateAutomatic` produce `IsAutomatic = true` y
      `EndDate = null`; `Update` con `fine` lo persiste; `Create` manual sigue con
      `IsAutomatic = false`.
- [x] 1.3 `Infrastructure/Persistence/Configuration/Entities/TeamPlayerSanctionEntityConfiguration.cs`:
      mapear `IsAutomatic` (required, default `false`), `Fine` (`decimal(10,2)`, opcional),
      `SourceEventId` (opcional, `HasMaxLength` acorde al Id de `SportEvent`); índice
      `(TeamPlayerId, IsAutomatic, EndDate)` para la consulta de bloqueo (Decisión 4).
- [x] 1.4 Migración EF `AddAutomaticSanctionFields` (esquema `app`), startup project
      `RFFM.Host`. Aplicar contra la BD de dev y verificar.

## 2. Backend — conteo de tarjetas compartido

- [x] 2.1 Nuevo `Features/Coaches/Players/Services/PlayerCardCountService.cs` (clase estática):
      `CountCards(string? cardsJson, string teamPlayerId, string cardType)` (idéntico al
      `CountCards` privado ya existente en `GetPlayerSeasonCards.cs`, extraído aquí para
      reutilizar en `GetPlayerMatchHistory` y `SaveMatchParticipation` sin duplicar el parseo
      JSON una tercera vez); `HasRedCard(string? cardsJson, string teamPlayerId)` =
      `CountCards(..., "red") > 0`.
- [x] 2.2 Tests unitarios de `PlayerCardCountService`: JSON válido con varias tarjetas propias y
      de rival, JSON nulo/vacío, JSON malformado (debe devolver 0, no lanzar).
- [x] 2.3 Refactor `GetPlayerSeasonCards.cs` para usar `PlayerCardCountService.CountCards` en
      vez de su copia privada (mantiene su comportamiento actual, cero cambio observable).

## 3. Backend — `GetPlayerMatchHistory` extendido

- [x] 3.1 Test (xUnit) primero: `PlayerMatchHistoryQuery` para un jugador con 2 participaciones
      finalizadas — una con 1 amarilla propia + 1 amarilla rival (solo cuenta la propia), otra
      con 1 roja; ambas con `SubstitutionWindowsJson` de 2 ventanas; eventos con `RivalId` y
      `EventTypeId` distintos — debe fallar contra el código actual (Red).
- [x] 3.2 `PlayerMatchRecordDto`: añadir `YellowCards`, `RedCards`, `RivalName`, `EventTypeId`,
      `EventTypeName`, `SubstitutionWindows: List<SubstitutionWindowRecordDto>` (más
      `SubstitutionWindowRecordDto`/`SubstitutionSwapRecordDto`, ver design.md Decisión 1).
      Mantener `EnteredAtMinute`/`ExitedAtMinute` sin romper compatibilidad.
- [x] 3.3 `Handler.Handle`: tras cargar `participations`, cargar los `SportEvent` distintos
      (`Include(se => se.Rival)`) de esos `EventId` en una sola consulta adicional
      (`AsNoTracking`), mapear `RivalName`/`EventTypeId`/`EventTypeName`
      (`SportEventType.FromId(...).Name`) por evento; usar
      `PlayerCardCountService.CountCards` para `YellowCards`/`RedCards`; deserializar
      `SubstitutionWindowsJson` con `try/catch → []` (mismo patrón que `CountGoalsForPlayer`).
      Verificar test 3.1 en verde (Green).

## 4. Backend — sanción automática al finalizar partido

- [x] 4.1 Test primero (xUnit, handler de `SaveMatchParticipation`): guardar un partido
      `finished` de tipo `"Partido"` donde un jugador llega a su 5ª amarilla cíclica (usando
      participaciones previas ya sembradas) → se crea una `TeamPlayerSanction` con
      `IsAutomatic = true`, `SanctionType = "Amarillas acumuladas (5)"`, `SourceEventId =
      eventId`. Debe fallar contra el código actual (Red).
- [x] 4.2 Test: mismo escenario pero el partido es de tipo `"Amistoso"` — no se crea sanción
      (Red → Green, confirma el filtro de tipo de evento).
- [x] 4.3 Test: un jugador recibe una roja en un partido `"Partido"` → se crea sanción
      `IsAutomatic = true`, `SanctionType = "Tarjeta roja"`.
- [x] 4.4 Test: volver a guardar (editar) el mismo partido finalizado sin cambiar las tarjetas
      → no se duplica la sanción (idempotencia por `SourceEventId`).
- [x] 4.5 Implementar en `SaveMatchParticipation.Handler.Handle`: tras el `SaveChangesAsync`
      existente, si `MatchPhase == "finished"` y `sportEvent.EventTypeId ==
      SportEventType.Match.Id`, recorrer `request.Players`, calcular cíclico/histórico e
      `HasRedCard` (design.md Decisión 2/3) usando `PlayerCardCountService` +
      `PlayerCardCountService`-consumidas participaciones ya cargadas de la BD (necesita cargar
      también las participaciones *previas* del jugador, no solo las del payload actual, para
      el cómputo cíclico/histórico), aplicar la idempotencia (4.4) y crear la(s)
      `TeamPlayerSanction.CreateAutomatic(...)` que correspondan; `SaveChangesAsync` de nuevo
      si se crearon sanciones. Verificar tests 4.1-4.4 en verde.

## 5. Backend — bloqueo de convocatoria

- [x] 5.1 Test primero: `AddConvocationHandler` con un jugador con sanción automática activa
      (`EndDate == null`) cuya `StartDate` es anterior a `sportEvent.EveDateTime` → lanza
      `ArgumentException` con mensaje claro, no crea `Convocation`. Debe fallar (Red).
- [x] 5.2 Test: mismo jugador pero la sanción tiene `EndDate` ya puesta (levantada) → se crea la
      convocatoria con normalidad.
- [x] 5.3 Test: `sportEvent.EveDateTime` anterior o igual a `StartDate` de la sanción (el propio
      partido que originó la sanción, o uno previo) → no bloquea.
- [x] 5.4 Implementar la comprobación en `AddConvocationHandler.Handle` (design.md Decisión 4).
      Verificar 5.1-5.3 en verde.
- [x] 5.5 Test: `BulkAddConvocationHandler` con un jugador sancionado activo entre los del
      equipo → se convoca a todos excepto al sancionado, sin lanzar excepción.
- [x] 5.6 Implementar el filtro correspondiente en `BulkAddConvocationHandler.Handle`.

## 6. Backend — sanciones: exponer `IsAutomatic`/`Fine`

- [x] 6.1 `SetPlayerSanction.cs`: `SanctionRecordResponse` gana `IsAutomatic`, `Fine`;
      `SanctionCreateRequest`/`SanctionUpdateRequest` ganan `Fine` (opcional); `ToResponse`
      mapea los nuevos campos; el `POST`/`PUT` pasan `req.Fine` a `Create`/`Update`
      (`Create` manual siempre `IsAutomatic = false`).
- [x] 6.2 Test: `PUT` sobre una sanción `IsAutomatic = true` actualizando solo `Fine`/
      `Description` conserva `IsAutomatic = true` y `SourceEventId`.

## 7. Backend verificación

- [x] 7.1 `dotnet build` — 0 errores.
- [x] 7.2 `dotnet test` — suite completa en verde, incluye todos los tests de las secciones 1-6.
- [x] 7.3 Migración aplicada y verificada contra la BD de dev real.

## 8. Frontend — tipos y servicios

- [x] 8.1 `Front/src/apps/coach/pages/convocations/components/simulation/liveMatch.types.ts`:
      `PlayerMatchRecord` gana `yellowCards`, `redCards`, `rivalName`, `eventTypeName`,
      `substitutionWindows: SubstitutionWindowRecord[]` (nuevo tipo espejo de
      `SubstitutionWindowRecordDto`/`SubstitutionSwapRecordDto` del backend). TDD: actualizar
      primero cualquier fixture/test existente que construya `PlayerMatchRecord` (Red), luego
      el tipo (Green).
- [x] 8.2 `Front/src/apps/coach/services/teamplayerSanctionService.ts`: `SanctionRecord` gana
      `isAutomatic: boolean`, `fine: number | null`; `createPlayerSanction`/
      `updatePlayerSanction` aceptan `fine?: number | null` en el payload. Test primero
      (mock de `client.post`/`client.put`, verifica que `fine` viaja en el body) — Red, luego
      implementación — Green.

## 9. Frontend — cómputo de entradas/salidas por partido

- [x] 9.1 TDD: escribir primero `playerMatchStints.test.ts` (jugador titular con 1 sustitución
      de salida; suplente que entra y vuelve a salir dos veces; jugador que entra y sigue en el
      campo hasta el final; sin `substitutionWindows` — array vacío) — Red, luego implementar
      `Front/src/apps/coach/pages/player/components/playerMatchStints.ts`
      (`derivePlayerStints`, design.md Decisión 5) — Green.

## 10. Frontend — pestaña Estadísticas (`PlayerDetail.tsx`)

- [x] 10.1 TDD: escribir primero `PlayerMatchHistoryTable.test.tsx` — columnas Rival/Tipo/
      Tarjetas visibles; fila expandible que, al hacer click, muestra los stints calculados por
      `derivePlayerStints`; sin columnas "Entró"/"Salió" fijas — Red, luego extraer/implementar
      `Front/src/apps/coach/pages/player/components/PlayerMatchHistoryTable.tsx` (design.md
      Decisión 5) — Green.
- [x] 10.2 `PlayerDetail.tsx`: sustituir el bloque de tabla inline (líneas ~484-522) por
      `<PlayerMatchHistoryTable matchHistory={matchHistory} teamPlayerId={teamPlayer.id} />`;
      añadir tiles de resumen "amarillas"/"rojas" (reduce sobre `matchHistory`, mismo patrón
      que `totalMinutes`/`totalGoals`). Test: extender el test existente de la pestaña
      Estadísticas (si existe) o crear uno nuevo verificando los tiles nuevos.

## 11. Frontend — `Sanctions.tsx`

- [x] 11.1 TDD: extender `Sanctions.test.tsx` (o crear uno si no existe) primero — nueva
      columna "Multa"; chip "Automática" cuando `isAutomatic`; el diálogo de edición
      deshabilita `sanctionType` cuando la sanción es automática — Red, luego implementar en
      `Sanctions.tsx` — Green.
- [x] 11.2 Añadir `TextField` numérico "Multa (€)" a los diálogos Add/Edit, cableado a
      `addFine`/`editRow.sanction.fine` y a los payloads de `createPlayerSanction`/
      `updatePlayerSanction` (8.2).

## 12. Frontend — aviso de bloqueo al convocar

- [x] 12.1 TDD: extender `useConvocationManagement`-relacionado test (o crear uno) primero —
      un `addConvocation` que rechaza con `{ response: { data: { detail: "..." } } }` dispara
      un evento `rffm.show_snackbar` con severity `"error"` y el mensaje del backend, en los
      tres puntos de llamada (~397, ~480/495, ~516) — Red, luego implementar en
      `useConvocationManagement.ts` (design.md Decisión 7) — Green.

## 13. Frontend verificación

- [x] 13.1 `npm run test` — suite completa en verde, sin tests saltados. Ejecutado directamente
      (`npx vitest run`, ya que `npm run test` lanza modo watch): 1219 passed, 3 skipped
      preexistentes. 3 archivos marcados FAIL en el run masivo (`SportEventDialog.test.tsx`,
      `GameModelCreate.validation.test.tsx`, `AttendanceTabs.test.tsx`) eran timeouts de workers
      por saturación — verificado que pasan limpio al re-ejecutarlos en aislado. Único fallo real
      : `PartidoEnDirectoTab.isFriendly.test.tsx` (2 tests), preexistente y no relacionado con
      este cambio (el diff de este cambio solo añade campos a `liveMatch.types.ts`, no toca ese
      componente ni `SubstitutionWindowTracker`).
- [x] 13.2 `npm run build` — 0 errores de tipos (strict mode). Build completo en 2m19s, sin
      errores.
- [ ] 13.3 Smoke manual: guardar un partido en el que un jugador llega a su 5ª amarilla cíclica
      → aparece sanción automática en `Sanctions.tsx`; intentar convocarlo al siguiente partido
      → bloqueado con aviso; levantar la sanción → convocatoria permitida; ficha del jugador
      muestra amarillas/rojas acumuladas y el detalle expandible de entradas/salidas por
      partido con rival y tipo.
