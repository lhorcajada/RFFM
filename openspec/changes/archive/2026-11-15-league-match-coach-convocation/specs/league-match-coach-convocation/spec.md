## Purpose
Defines the coach-only convocation flow of league matches in the coach app: direct landing on the match page, three convocation zones, waiting-list actions, and a deconvocation reason shown inside the player card.

## ADDED Requirements

### Requirement: Coach lands directly on the match page for league matches
When a Coach or Administrator opens a league match event (`matchCategory` equal to `League`) from an event card or a direct link to `/coach/attendance/{eventId}`, the app SHALL navigate to `/coach/convocations/match?teamId={teamId}&eventId={eventId}` instead of showing the attendance form. Players and family members SHALL keep the attendance page. Events that are not league matches SHALL keep the attendance page for every role.

#### Scenario: Coach opens a league match
- **WHEN** a coach opens a league match event
- **THEN** the match page is shown and the attendance form is not rendered

#### Scenario: Player opens a league match
- **WHEN** a player opens a league match event
- **THEN** the attendance page is shown as before

#### Scenario: Coach opens a friendly or a training
- **WHEN** a coach opens a friendly match or a training event
- **THEN** the attendance page is shown as before

### Requirement: League match page shows three convocation zones
The «Convocatoria» tab of the match page of a league match SHALL show only the zones «Lista de espera», «Convocados» and «Desconvocados», each with its counter. It SHALL NOT show «Pendientes de respuesta» nor «Disponibles». A player without convocation SHALL appear in «Lista de espera» whatever the status of any past availability request. Friendly matches SHALL keep their current zones.

#### Scenario: Three zones only
- **WHEN** the coach opens the match page of a league match
- **THEN** the zones are «Lista de espera», «Convocados» and «Desconvocados» and no counter or zone for pending responses or available players is shown

#### Scenario: Player with an old availability request
- **WHEN** a player has no convocation and has an availability request in status `Requested` or `Available`
- **THEN** the player is listed in «Lista de espera»

#### Scenario: Friendly unchanged
- **WHEN** the coach opens the match page of a friendly match
- **THEN** the zones are the same as before this change

### Requirement: Coach convokes or deconvokes from the waiting list
Each player card in «Lista de espera» of a league match SHALL show the buttons «Convocar» and «Desconvocar» with a minimum touch target of 44 px. «Convocar» SHALL create the convocation through the regular convocation endpoints and move the player to «Convocados». «Desconvocar» SHALL open the deconvocation reason picker. If a call fails, the player SHALL stay in the previous zone and the error SHALL be shown.

#### Scenario: Convoke from the waiting list
- **WHEN** the coach taps «Convocar» on a waiting-list player
- **THEN** the player moves to «Convocados»

#### Scenario: Convoke fails
- **WHEN** the coach taps «Convocar» and the API returns an error
- **THEN** the player stays in «Lista de espera» and the error is shown

#### Scenario: Deconvoke opens the picker
- **WHEN** the coach taps «Desconvocar» on a waiting-list player
- **THEN** the reason picker opens and the player has not moved yet

### Requirement: Deconvocation reason picker
Deconvoking a player from «Lista de espera» or «Convocados» in a league match SHALL open a picker listing the available excuse types as large selectable options, with «Cancelar» and «Desconvocar» actions. «Desconvocar» SHALL stay disabled until a reason is selected. Confirming SHALL move the player to «Desconvocados» with the selected reason; cancelling SHALL leave the player where they were.

#### Scenario: Confirm with a reason
- **WHEN** the coach selects «Lesión» and confirms
- **THEN** the player moves to «Desconvocados» with reason «Lesión»

#### Scenario: Confirm without a reason
- **WHEN** the picker is open and no reason is selected
- **THEN** «Desconvocar» is disabled

#### Scenario: Cancel
- **WHEN** the coach cancels the picker
- **THEN** the player stays in their zone and nothing is saved

### Requirement: Deconvoked card shows the reason inside the card
Each player card in «Desconvocados» of a league match SHALL show the reason inside the card as an amber strip «Motivo: {reason}» at the bottom of the card, and SHALL NOT render a reason selector outside the card. Activating the strip SHALL open the reason picker to change the reason. The card SHALL show a «Convocar» button that moves the player back to «Convocados».

#### Scenario: Reason inside the card
- **WHEN** a deconvoked player has reason «Decisión técnica»
- **THEN** the card shows «Motivo: Decisión técnica» inside it and no select element is rendered next to the card

#### Scenario: Change the reason
- **WHEN** the coach activates the strip and picks another reason
- **THEN** the card shows the new reason

#### Scenario: Reconvoke
- **WHEN** the coach taps «Convocar» on a deconvoked player
- **THEN** the player moves to «Convocados»
