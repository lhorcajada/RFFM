# deconvocation-saved-proposals Specification

## Purpose
TBD - created by archiving change deconvocation-proposal-search-and-saved. Update Purpose after archive.
## Requirements
### Requirement: Save the current proposal
The current proposal view SHALL offer «Guardar propuesta», which stores the players currently proposed for deconvocation, in their order and including a manual order, under a name of 1 to 60 characters prefilled with «Propuesta N». Already deconvoked players SHALL NOT be stored. The action SHALL be disabled when no player is proposed and SHALL NOT be offered in the estimates of upcoming matches. Saving SHALL NOT change the convocation.

#### Scenario: Save a manual order
- **WHEN** the coach changes the order by hand and saves
- **THEN** the saved proposal holds the players proposed with that manual order

#### Scenario: Saving does not deconvoke
- **WHEN** the coach saves a proposal
- **THEN** no player changes convocation status

#### Scenario: Save fails
- **WHEN** the server rejects or cannot store the proposal
- **THEN** the view shows an error notice and the saved list is unchanged

### Requirement: Saved proposals of a match
The view SHALL list the saved proposals of the match, oldest first, each as a card with its name, saved date and player names. The list SHALL be the same from any device. A match SHALL hold at most 10 saved proposals.

#### Scenario: Several proposals
- **WHEN** two proposals have been saved for a match
- **THEN** both are listed with their own players

#### Scenario: Limit reached
- **WHEN** a match already has 10 saved proposals and another is saved
- **THEN** the server rejects it with a conflict and the coach is told to delete one first

#### Scenario: Already applied
- **WHEN** every player of a saved proposal is currently deconvoked
- **THEN** its card is marked «Aplicada» and it cannot be applied again

### Requirement: Apply a saved proposal
Each saved proposal SHALL offer «Aplicar», which asks for confirmation listing the players that will be deconvoked and any other players already deconvoked, who stay out. On confirmation the system SHALL deconvoke by technical decision the saved players that are not already out. Players already out SHALL keep their reason, no player SHALL be called up again, and the convocation SHALL NOT be published.

#### Scenario: Confirm
- **WHEN** the coach confirms
- **THEN** the saved players not already out are deconvoked by technical decision and a league convocation remains a draft

#### Scenario: Cancel
- **WHEN** the coach cancels the confirmation
- **THEN** no player changes status

#### Scenario: Player no longer in the squad
- **WHEN** a saved player is no longer in the squad
- **THEN** the card says how many players are unavailable and applying ignores them

### Requirement: Delete a saved proposal
Each saved proposal SHALL be deletable after a confirmation. Deleting SHALL NOT change the convocation.

#### Scenario: Delete
- **WHEN** the coach confirms the deletion
- **THEN** the proposal disappears from the list and no player changes status

### Requirement: Saved proposals are restricted and validated
Only users who can manage the team of the match SHALL read, create or delete its saved proposals. The server SHALL reject a proposal with a blank or longer than 60 characters name, with no players, with repeated players, or with players that do not belong to the match's team. Errors SHALL be returned as ProblemDetails. Deleting a match SHALL delete its saved proposals.

#### Scenario: User from another team
- **WHEN** a coach who cannot manage the team requests its saved proposals
- **THEN** the server answers forbidden

#### Scenario: Foreign player
- **WHEN** a proposal includes a player of another team
- **THEN** the server rejects it and stores nothing

#### Scenario: Proposal of another match
- **WHEN** a delete request names a proposal that does not belong to the given match
- **THEN** the server answers not found and deletes nothing

