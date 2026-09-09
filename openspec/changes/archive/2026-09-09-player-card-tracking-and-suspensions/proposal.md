## Why

La ficha de jugador (Coach) ya guarda tarjetas (`MatchParticipation.CardsJson`) y ventanas de
sustitución (`SubstitutionWindowsJson`) por partido, pero la pestaña "Estadísticas" no muestra
el acumulado de amarillas/rojas del jugador, y el grid de partidos solo expone
`EnteredAtMinute`/`ExitedAtMinute` (una única entrada/salida), que no representa a un jugador
que entra y sale varias veces en el mismo partido; tampoco muestra tarjetas, rival ni tipo de
partido. Además no existe ninguna lógica de sanción automática: hoy `TeamPlayerSanction` solo
se crea/edita a mano desde `Sanctions.tsx`. Un jugador que llega a 5 amarillas (contador
cíclico) o es expulsado (roja) en un partido de liga debería quedar sancionado
automáticamente, sin que el entrenador tenga que llevar la cuenta manualmente ni pueda olvidar
convocarlo por error.

## What Changes

- Backend: `GetPlayerMatchHistory` (`GET /api/catalog/team-player/{id}/match-history`) pasa a
  incluir, por partido: tarjetas amarillas/rojas del jugador, nombre del rival, tipo de evento,
  y la lista completa de ventanas de sustitución (no solo una entrada/salida).
- Backend: al guardar un partido de tipo `"Partido"` como `finished`
  (`SaveMatchParticipation`), si un jugador alcanza su 5ª amarilla cíclica o recibe una roja, el
  sistema crea automáticamente una `TeamPlayerSanction` (`IsAutomatic: true`, motivo
  autogenerado, `SourceEventId`). Amistosos y torneos no cuentan para este contador ni disparan
  sanción.
- Backend: `AddConvocations` bloquea (`400`) convocar a un jugador con sanción automática activa
  a un partido posterior a la fecha de la sanción; la convocatoria masiva
  (`AddConvocations/bulk`) omite silenciosamente a esos jugadores.
- Backend: `TeamPlayerSanction` gana `IsAutomatic` y `Fine` (multa); el coach puede editar
  descripción/multa/fechas de una sanción automática desde los endpoints de sanciones ya
  existentes.
- Frontend: en `PlayerDetail.tsx` (pestaña Estadísticas), se añade el acumulado de
  amarillas/rojas al resumen; se sustituyen las columnas "Entró"/"Salió" del grid por una fila
  expandible con el detalle de cada entrada/salida (minutos), y se añaden columnas de
  tarjetas/rival/tipo de partido.
- Frontend: en `Sanctions.tsx`, se distingue visualmente una sanción automática de una manual y
  se permite editar/añadir el campo multa.
- Frontend: al intentar convocar a un jugador sancionado, se muestra el aviso de bloqueo
  devuelto por el backend (reutilizando el bus de eventos `rffm.show_snackbar` existente).

**Non-goals**: no se modela qué partido concreto "cumple" la sanción — el bloqueo de
convocatoria dura hasta que el coach la levanta desde `Sanctions.tsx` (acción "Levantar
sanción" ya existente), igual que cualquier sanción manual hoy. No se gestionan sanciones
federativas externas (RFFM) ni su sincronización. No se toca la lógica de edición en vivo
(`LiveMatchScoreboard`/`CardEventDialog`) más allá de lo estrictamente necesario para que los
datos que ya captura lleguen a los nuevos endpoints.

## Capabilities

### New Capabilities
- `player-card-discipline`: acumulado histórico y cíclico de amarillas/rojas por jugador
  (derivado, no persistido), detección y creación automática de sanción al alcanzar 5 amarillas
  cíclicas o recibir una roja en un partido de liga, y bloqueo de convocatoria mientras la
  sanción automática esté activa.

### Modified Capabilities
- `player-sanctions`: `POST`/`PUT` de sanción ganan el campo opcional `fine`; las sanciones
  creadas automáticamente se distinguen con `isAutomatic: true` y no son editables en ese campo
  ni en `sourceEventId`.

## Impact

- Backend: `Domain/Entities/TeamPlayers/TeamPlayerSanction.cs` (nuevos campos +
  `CreateAutomatic`), migración EF `AddAutomaticSanctionFields`;
  `Features/Coaches/Players/Queries/GetPlayerMatchHistory.cs` (DTO extendido);
  `Features/Coaches/Players/Services/PlayerCardCountService.cs` (nuevo, compartido con
  `GetPlayerSeasonCards.cs`); `Features/Coaches/Convocations/SaveMatchParticipation.cs`
  (detección/creación de sanción automática); `Features/Coaches/Convocations/
  AddConvocations.cs` (bloqueo); `Features/Coaches/Players/Commands/SetPlayerSanction.cs`
  (campo `fine`).
- Frontend: `Front/src/apps/coach/pages/player/PlayerDetail.tsx` +
  nuevo `pages/player/components/PlayerMatchHistoryTable.tsx` y
  `playerMatchStints.ts`; `apps/coach/pages/convocations/components/simulation/
  liveMatch.types.ts`; `apps/coach/services/teamplayerSanctionService.ts`;
  `apps/coach/pages/sanctions/Sanctions.tsx`; `apps/coach/pages/convocations/hooks/
  useConvocationManagement.ts` (surfacing del error de bloqueo).
