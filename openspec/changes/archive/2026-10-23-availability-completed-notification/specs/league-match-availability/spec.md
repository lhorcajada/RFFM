## ADDED Requirements

### Requirement: Coaches are notified when availability is complete
When a response is given to an availability request in status `Requested` (by a Player, a FamilyMember, a Coach or an Administrator) and, after it, the event has no pending availability request, the system SHALL notify the team coaches with an in-app notification and a Web Push notification of type `AvailabilityCompleted`. A request SHALL be pending when it is in status `Requested` and its player has no convocation for the event. The title SHALL be «Disponibilidad completada», the body SHALL be `Todos los jugadores han marcado su disponibilidad para {evento} el {dd/MM/yyyy}.`, omitting ` el {dd/MM/yyyy}` when the event has no date, and the deep link SHALL be `/coach/attendance/{eventId}`. Changing a response that was already given SHALL NOT send the notification. A notification failure SHALL NOT make the response fail.

#### Scenario: Last pending player answers
- **WHEN** the only pending request of «Jornada 7» on 18/10/2026 is answered by the player
- **THEN** the coaches receive «Todos los jugadores han marcado su disponibilidad para Jornada 7 el 18/10/2026.» in addition to the individual response notification

#### Scenario: Players still pending
- **WHEN** a player answers and another request of the event is still `Requested`
- **THEN** the coaches do not receive the completed notification

#### Scenario: Coach answers the last pending player
- **WHEN** a coach answers on behalf of the last pending player
- **THEN** the coaches receive the completed notification

#### Scenario: Last pending player answers no
- **WHEN** the last pending player answers no with a reason
- **THEN** the coaches receive the completed notification

#### Scenario: Requested player already convoked is not pending
- **WHEN** the last pending player answers and the only other `Requested` request belongs to a player already convoked for the event
- **THEN** the coaches receive the completed notification

#### Scenario: Changing an answer does not notify again
- **WHEN** a player who was `Available` changes the answer to not available and no request is pending
- **THEN** the coaches do not receive the completed notification
