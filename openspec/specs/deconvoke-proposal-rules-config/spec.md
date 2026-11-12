# deconvoke-proposal-rules-config Specification

## Purpose
TBD - created by archiving change configurable-deconvocation-rules. Update Purpose after archive.
## Requirements
### Requirement: Rule catalog of available conditions
The system SHALL provide a fixed catalog of conditions a deconvocation rule can be based on: season goals, streak without technical deconvocation, minimum required calls, previous result against the rival, injured player, weekly training attendance, recent recovery from injury, recent deconvocation, accumulated technical deconvocations, weighted rating, team necessity and season training attendance. A team's rule set SHALL contain at most one rule per condition.

#### Scenario: Adding a rule offers only unused conditions
- **WHEN** the coach adds a rule and the team already has rules for goals and streak
- **THEN** the list of conditions offered excludes goals and streak and includes the remaining ones

#### Scenario: All conditions already used
- **WHEN** the team has one rule for every condition in the catalog
- **THEN** the add-rule action is not available

### Requirement: Default rule configuration
A team without a saved configuration SHALL use the default configuration, whose texts, points and weights equal the values currently used by the deconvocation proposal, so the proposal result is unchanged until the coach edits it.

#### Scenario: Team never configured
- **WHEN** the proposal is generated for a team with no saved configuration
- **THEN** every rule uses its default text, points and weights and the scores equal those produced before this change

### Requirement: Rule points and weights shown separately
Each rule SHALL expose its **points** (base magnitude the rule adds or subtracts) and its **weights** (named factors specific to the condition, e.g. the penalty per excuse type of the weekly attendance condition) as separate editable values. The coach SHALL be able to edit the rule text, its points and its weights.

#### Scenario: Editing a rule
- **WHEN** the coach changes the points of the goals rule from 2 to 3 and saves
- **THEN** a player with 4 league goals receives 12 points from that rule in the next proposal

#### Scenario: Weights edited independently from points
- **WHEN** the coach changes only a weight of a rule
- **THEN** the rule's points stay unchanged

### Requirement: Mandatory rules are editable
Rules that force a deconvocation by default (injured, recent recovery from injury, no weekly training attendance) SHALL be editable and removable like any other rule. A rule that is present SHALL keep its forced behaviour.

#### Scenario: Editing the injured rule text
- **WHEN** the coach changes the text of the injured rule
- **THEN** the proposal shows the new text for injured players and they are still deconvoked

#### Scenario: Removing a mandatory rule
- **WHEN** the coach deletes the injured rule and saves
- **THEN** injured players are no longer forced out by that rule in the next proposal

### Requirement: Per-team persistence and authorization
The configuration SHALL be stored per team. Reading it SHALL be allowed to the team's coaches; creating, changing and restoring it SHALL be allowed only to the team's coach role. The backend SHALL validate that every rule uses a known condition, no condition is repeated, the text is not empty and points and weights are finite numbers within a bounded range, and SHALL return RFC 7807 `ProblemDetails` on error.

#### Scenario: Save valid configuration
- **WHEN** a coach of the team sends a valid rule set
- **THEN** it is stored and returned, and a later read returns the same rules

#### Scenario: Reject unknown or repeated condition
- **WHEN** the request contains an unknown condition or the same condition twice
- **THEN** the response is 400 with `ProblemDetails` and nothing is stored

#### Scenario: Non-coach cannot write
- **WHEN** a user who is not a coach of the team sends the configuration
- **THEN** the response is 403 and nothing is stored

#### Scenario: Configuration is not shared between teams
- **WHEN** team A saves a configuration
- **THEN** team B still uses its own configuration or the default

### Requirement: Restore default
The coach SHALL be able to restore the default configuration, which discards the team's saved configuration.

#### Scenario: Restore after customizing
- **WHEN** the coach restores the default and confirms in the confirmation dialog
- **THEN** the team's saved configuration is deleted and the next proposal uses the default values

### Requirement: Proposal uses the current configuration
The proposal engine SHALL score players with the team's current rule configuration (texts, points, weights; only the rules present). The proposal screen SHALL have an **Actualizar** button that reloads the team's configuration and regenerates the proposal. Changes SHALL NOT alter proposals of past matches.

#### Scenario: Update after editing rules
- **WHEN** the coach edits the rules and presses Actualizar on the proposal screen
- **THEN** the proposal is regenerated with the new rules

#### Scenario: Rule removed from configuration
- **WHEN** the streak rule is not in the team's configuration
- **THEN** no streak factor appears for any player and the streak contributes 0 points

### Requirement: Responsive configuration screen
The rules configuration UI SHALL present each rule as a card (no tables), usable from ~360px to desktop, with texts in Spanish, and SHALL use the shared confirmation dialog for deleting a rule and restoring the defaults.

#### Scenario: Narrow viewport
- **WHEN** the configuration is opened on a 360px wide viewport
- **THEN** the rule cards stack vertically without horizontal scroll

