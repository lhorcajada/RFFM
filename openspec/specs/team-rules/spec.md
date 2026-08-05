# team-rules Specification

## Purpose
Team-scoped structured rules ("normas del equipo"): a coach-managed, database-backed set of rules
read by any team member on Mobile and managed (create/edit/delete) by Coach/Admin from both Front
and Mobile. Replaces the earlier PDF-upload-based `mobile-team-rules-document` capability.

## Requirements
### Requirement: Team has one structured rules set
A `Team` SHALL have at most one `TeamRulesSet`, composed of a `Title`, `Subtitle`, `IntroNote`, optional `ClosingNote`, optional `ApplicationNote`, and an ordered, non-empty list of `TeamRule`s once created. Each `TeamRule` SHALL have an `Order`, `ShortTitle`, optional `Highlight`, `ViolationSummary`, `ConsequenceSummary`, optional `LongDescription`, optional list of `BulletPoints`, and optional `ConsequenceDetail`.

#### Scenario: Team with no rules set yet
- **WHEN** a `Team` has never had a `TeamRulesSet` saved
- **THEN** reads of the team's rules return no data (no rules set), distinct from an error

#### Scenario: Rules are read in order
- **WHEN** a `TeamRulesSet`'s rules are read
- **THEN** they are returned ordered by `Order`, ascending, starting at 1

### Requirement: Team rules reading (any team member)
The Mobile app SHALL provide a "Normas del equipo" screen, reachable from the Equipo menu, where any team member can read the team's structured rules, or see a message that none are available yet.

#### Scenario: Rules set exists
- **WHEN** a team member opens "Normas del equipo" for a team that has a `TeamRulesSet`
- **THEN** the screen displays the intro note, each rule (short title, highlight, violation/consequence summary, expandable long description/bullets/consequence detail), and the closing/application notes, natively (no document viewer)

#### Scenario: No rules set yet
- **WHEN** a team member opens "Normas del equipo" for a team with no `TeamRulesSet`
- **THEN** the screen shows the message "Aún no disponible" instead of content

#### Scenario: Rules fail to load
- **WHEN** the request to fetch the team's rules fails
- **THEN** the screen shows an error message derived from `e.response?.data?.detail` or a Spanish fallback message, matching the standard Mobile data-loading pattern

### Requirement: Team rules CRUD by Coach/Admin (Front and Mobile)
Coach and Admin roles SHALL be able to create, edit (metadata and rules, including reordering), and delete a team's rules set, from both the Coach web app (Front) and Mobile. Other roles SHALL NOT see any create/edit/delete control.

#### Scenario: Coach creates the first rules set
- **WHEN** a Coach on a team with no rules set fills in the metadata and at least one rule and saves
- **THEN** a `TeamRulesSet` is created for that team with the given metadata and ordered rules

#### Scenario: Coach edits metadata and rules
- **WHEN** a Coach on a team with an existing rules set changes metadata fields and/or adds, edits, removes, or reorders rules, then saves
- **THEN** the rules set is replaced with the new metadata and the new ordered list of rules in a single save

#### Scenario: Coach deletes the rules set
- **WHEN** a Coach or Admin confirms deletion of a team's rules set
- **THEN** the `TeamRulesSet` and all of its rules are removed, and the team returns to "no rules set" state

#### Scenario: Non-coach/admin cannot create, edit, or delete
- **WHEN** a Player or FamilyMember opens "Normas del equipo"
- **THEN** no create/edit/delete control is shown, and any direct attempt to call the write endpoints is rejected by the backend with an authorization error

#### Scenario: Save requires at least one rule
- **WHEN** a Coach attempts to save a rules set with zero rules
- **THEN** the backend rejects the request with a validation error and no change is persisted

### Requirement: Team rules backend endpoints (dual namespace)
The backend SHALL expose `GET`, `PUT`, and `DELETE` on `api/mobile/teams/{teamId}/rules` (consumed by Mobile) and the equivalent `api/coaches/teams/{teamId}/rules` (consumed by Front), backed by the same command/query handlers. `GET` SHALL be accessible by any team member; `PUT`/`DELETE` SHALL require Coach/Admin feature permission.

#### Scenario: PUT creates or replaces the rules set
- **WHEN** `PUT .../teams/{teamId}/rules` succeeds
- **THEN** the response is `200 OK` with the resulting structured rules set, and `Order` values are contiguous starting at 1

#### Scenario: GET returns the structured rules set when present
- **WHEN** `GET .../teams/{teamId}/rules` is called for a team with a `TeamRulesSet`
- **THEN** the response is `200 OK` with the full structured payload

#### Scenario: GET returns no content when absent
- **WHEN** `GET .../teams/{teamId}/rules` is called for a team with no `TeamRulesSet`
- **THEN** the response is `204 No Content`

#### Scenario: GET returns not found for a non-existent team
- **WHEN** `GET .../teams/{teamId}/rules` is called with a `teamId` that does not exist
- **THEN** the response is `404 Not Found`

#### Scenario: DELETE removes the rules set idempotently
- **WHEN** `DELETE .../teams/{teamId}/rules` is called for a team with or without an existing `TeamRulesSet`
- **THEN** the response is `204 No Content` and the team has no `TeamRulesSet` afterward
