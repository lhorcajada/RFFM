## MODIFIED Requirements

### Requirement: League match convocation screen shows availability lists
For league matches, the Coach or Administrator convocation tab of the match page SHALL NOT show the groups «Pendientes de respuesta» nor «Disponibles»; it SHALL show only «Lista de espera», «Convocados» and «Desconvocados» (see capability `league-match-coach-convocation`). The own player of a Player or FamilyMember SHALL still be shown in the «Tu jugador» card of the attendance page and SHALL still be able to answer their availability request there. For non-league events the screen SHALL behave as before.

#### Scenario: Coach sees no availability groups
- **WHEN** a coach opens the convocation tab of a league match
- **THEN** no «Pendientes de respuesta» nor «Disponibles» group is shown

#### Scenario: Friendly unchanged
- **WHEN** a coach opens the convocation tab of a friendly match
- **THEN** the screen behaves as before this change

#### Scenario: Player answers from the event screen
- **WHEN** a player opens a league match where their request is `Requested`
- **THEN** the «Tu jugador» card shows «Sí, disponible» and «No disponible», and «No disponible» asks for a mandatory reason that excludes «Decisión técnica» and «Sanción deportiva»

## REMOVED Requirements

### Requirement: Coach manages availability from the convocation tab
**Reason**: In league matches only the coach decides who is called up, so the coach no longer answers availability requests on behalf of players nor convokes through the availability decision endpoint from the match page.
**Migration**: The coach convokes from «Lista de espera» through the regular convocation endpoints. The availability endpoints stay available to the backend and to players.
