# league-match-availability Specification

## Purpose
TBD - created by archiving change league-match-availability. Update Purpose after archive.
## Requirements
### Requirement: Coach requests availability for a league match
The system SHALL expose `POST /api/events/{eventId}/availability-requests`, restricted to Coach and Administrator roles, which creates an availability request in status `Requested` for every player of the event's team that has no convocation for the event, is not injured on the event date and is not blocked by an active automatic sanction. The endpoint SHALL only be allowed for league matches (event type `Partido`, id 1); for any other event type it SHALL return `400` ProblemDetails with code `AvailabilityOnlyForLeagueMatches`. Players that already have a request in status `Requested` or `Available` SHALL be skipped, and requests in status `Unavailable` without a convocation SHALL be reopened to `Requested`. The response SHALL include `requestedCount`: the number of requests created plus the number reopened.

#### Scenario: Requests created for the waiting list
- **WHEN** a coach requests availability for a league match with three unconvoked, healthy, unsanctioned players
- **THEN** three requests in status `Requested` are created and `requestedCount` is 3

#### Scenario: Convoked, injured and sanctioned players are skipped
- **WHEN** the team has one convoked player, one player injured before the event date, one player blocked by an active automatic sanction and one available player
- **THEN** only the available player gets a request

#### Scenario: Requesting twice is idempotent
- **WHEN** a coach requests availability twice for the same league match
- **THEN** the second call creates no new requests, sends no new notifications and returns `requestedCount` 0

#### Scenario: Non-league event rejected
- **WHEN** a coach requests availability for a friendly match or a training
- **THEN** the system returns `400` with code `AvailabilityOnlyForLeagueMatches`

#### Scenario: Player cannot request availability
- **WHEN** a Player calls the endpoint
- **THEN** the system returns `403`

### Requirement: Availability request notification
When an availability request is created or reopened, the system SHALL notify the player and the player's linked family members with an in-app notification and a Web Push notification of type `AvailabilityRequested`. The body SHALL be `¿{alias}, estás disponible para el partido «{evento}» el próximo {dd/MM} a las {HH:mm}?`, omitting ` a las {HH:mm}` when the event has no time. The deep link SHALL be `/coach/attendance/{eventId}`. A notification failure SHALL NOT make the request fail.

#### Scenario: Notification text
- **WHEN** availability is requested for player «Lucas» and the event «Jornada 5 - CD Ejemplo» on 18/10 at 11:30
- **THEN** Lucas and his family members receive «¿Lucas, estás disponible para el partido «Jornada 5 - CD Ejemplo» el próximo 18/10 a las 11:30?»

### Requirement: Event availability requests are listed
The system SHALL expose `GET /api/events/{eventId}/availability-requests`, readable by the members of the event's team, returning every availability request of the event with `id`, `teamPlayerId`, `status` (`Requested`, `Available` or `Unavailable`), `requestedAt` and `respondedAt`.

#### Scenario: List requests
- **WHEN** an event has one `Requested` and one `Available` request
- **THEN** both are returned with their status

### Requirement: Player or family member responds to availability
The system SHALL expose `PUT /api/events/{eventId}/availability-requests/{requestId}/response` with body `{ available, excuseTypeId? }`. Player and FamilyMember users SHALL only respond for the player linked to their account; otherwise the system SHALL return `403`. Coach and Administrator users MAY respond on behalf of any player. When `available` is true, the request SHALL become `Available` and no convocation SHALL be created. When `available` is false, `excuseTypeId` SHALL be required and SHALL NOT be «Decisión técnica» (7) or «Sanción deportiva» (8); the request SHALL become `Unavailable` and the player SHALL get a convocation in status `Deconvoke` with that excuse. If the player already has a convocation for the event, the system SHALL return `409` with code `AvailabilityAlreadyDecided`. When the responder is a Player or FamilyMember, the team coaches SHALL be notified of the response.

#### Scenario: Player says yes
- **WHEN** a player answers yes to their `Requested` request
- **THEN** the request becomes `Available`, the player has no convocation and the coaches are notified «{alias} está disponible para …»

#### Scenario: Family member says no with a reason
- **WHEN** a family member answers no with excuse «Enfermedad»
- **THEN** the request becomes `Unavailable` and the player has a `Deconvoke` convocation with excuse «Enfermedad»

#### Scenario: Missing reason rejected
- **WHEN** a player answers no without `excuseTypeId`
- **THEN** the system returns `400`

#### Scenario: Coach-only reason rejected
- **WHEN** a player answers no with excuse «Decisión técnica»
- **THEN** the system returns `400`

#### Scenario: Another player's request
- **WHEN** a player responds to the request of a different player
- **THEN** the system returns `403`

#### Scenario: Already decided by the coach
- **WHEN** a player responds after the coach has already convoked them
- **THEN** the system returns `409` with code `AvailabilityAlreadyDecided`

### Requirement: Coach decides on available players
The system SHALL expose `POST /api/events/{eventId}/availability-requests/{requestId}/decision` with body `{ convoke }`, restricted to Coach and Administrator roles. The request SHALL be in status `Available`; otherwise the system SHALL return `409` with code `AvailabilityNotAvailable`. When `convoke` is true, the system SHALL create a convocation in status `Accepted` and notify the player and the family members with the existing convocation-created notification. When `convoke` is false, the system SHALL create a convocation in status `Deconvoke` with the excuse «Decisión técnica» (7). If the player already has a convocation, the system SHALL return `409` with code `AvailabilityAlreadyDecided`.

#### Scenario: Convoke an available player
- **WHEN** the coach convokes an available player
- **THEN** the player has an `Accepted` convocation and is notified

#### Scenario: Deconvoke an available player
- **WHEN** the coach deconvokes an available player
- **THEN** the player has a `Deconvoke` convocation with excuse «Decisión técnica»

#### Scenario: Request not available
- **WHEN** the coach decides on a request in status `Requested`
- **THEN** the system returns `409` with code `AvailabilityNotAvailable`

### Requirement: League match convocation screen shows availability lists
For league matches, the convocation tab SHALL show, in addition to the existing groups, the groups «Pendientes de respuesta» (players without convocation whose request is `Requested`) and «Disponibles» (players without convocation whose request is `Available`). A player with a convocation SHALL always be shown in the group of their convocation status. The waiting list SHALL show the button «Pedir disponibilidad» instead of «Convocar toda la lista de espera». For non-league events the screen SHALL behave as before.

#### Scenario: Request availability button on league match
- **WHEN** a coach opens the convocation tab of a league match with players on the waiting list
- **THEN** the button «Pedir disponibilidad» is shown and «Convocar toda la lista de espera» is not

#### Scenario: Friendly keeps bulk convocation
- **WHEN** a coach opens the convocation tab of a friendly match
- **THEN** the button «Convocar toda la lista de espera» is shown and no availability groups are shown

#### Scenario: Player answers from the event screen
- **WHEN** a player opens a league match where their request is `Requested`
- **THEN** their card in «Pendientes de respuesta» shows «Sí, disponible» and «No disponible», and «No disponible» asks for a mandatory reason that excludes «Decisión técnica» and «Sanción deportiva»

#### Scenario: Coach convokes from available
- **WHEN** the coach clicks «Convocar» on a player in «Disponibles»
- **THEN** the player moves to «Convocados»

#### Scenario: Coach deconvokes from available
- **WHEN** the coach clicks «Desconvocar» on a player in «Disponibles» and confirms
- **THEN** the player moves to «Desconvocados» with reason «Decisión técnica»

### Requirement: Player lists are grouped by position
Every player list in the convocation tab SHALL group its players under the headings, in this order: «Porteros», «Defensas» (centrales, laterales, carrileros, líbero), «Medios» (all midfielders, including the attacking midfielder), «Extremos», «Delanteros» (delantero centro and segundo delantero) and «Sin posición». Empty groups SHALL NOT be shown.

#### Scenario: Grouping order
- **WHEN** a list contains a Delantero Centro, a Portero, a Lateral Derecho and an Extremo Izquierdo
- **THEN** the headings appear in the order Porteros, Defensas, Extremos, Delanteros, and no «Medios» heading is shown

#### Scenario: Attacking midfielder and second striker
- **WHEN** a list contains a «Mediocampista ofensivo» and a «Segundo Delantero»
- **THEN** the first is under «Medios» and the second under «Delanteros»

#### Scenario: Player without position
- **WHEN** a player has no position
- **THEN** the player is shown under «Sin posición»

