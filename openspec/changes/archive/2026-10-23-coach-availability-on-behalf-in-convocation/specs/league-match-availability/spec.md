## ADDED Requirements

### Requirement: Coach manages availability from the convocation tab
For league matches, the convocation tab of the match page SHALL let the coach act on the availability lists without leaving the page. Each player in «Pendientes de respuesta» SHALL show a «Disponible» button that answers the player's availability request as available on their behalf (`PUT /api/events/{eventId}/availability-requests/{requestId}/response` with `available: true`), and the player SHALL move to «Disponibles». Convoking players from «Disponibles» (selected players or dragging to «Convocados») SHALL use `POST /api/events/{eventId}/availability-requests/{requestId}/decision` with `convoke: true`, so no push notification is sent to the player, the family or the coaches. If a call fails, the player SHALL go back to the previous list and the error SHALL be shown.

#### Scenario: Coach marks a pending player as available
- **WHEN** the coach clicks «Disponible» on a player in «Pendientes de respuesta»
- **THEN** the availability request is answered as available and the player moves to «Disponibles»

#### Scenario: Marking available fails
- **WHEN** the coach clicks «Disponible» and the API returns an error
- **THEN** the player stays in «Pendientes de respuesta» and the error is shown

#### Scenario: Coach convokes available players
- **WHEN** the coach convokes a player from «Disponibles» in a league match
- **THEN** the decision endpoint is called with `convoke: true`, no convocation is created through the convocation endpoints and the player moves to «Convocados»

#### Scenario: Friendly match unchanged
- **WHEN** the coach convokes an available player of a friendly match
- **THEN** the convocation is created through the convocation endpoints as before and no «Disponible» button is shown
