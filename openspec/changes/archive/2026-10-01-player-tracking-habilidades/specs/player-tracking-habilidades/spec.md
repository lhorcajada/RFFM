## ADDED Requirements

### Requirement: Game-model observations can name the skills involved
Creating a game-model observation SHALL accept optional `habilidades`: at most 5 distinct values from the closed Habilidad vocabulary. Attitude observations SHALL NOT accept `habilidades`. Observation responses SHALL include `habilidades` (empty when none).

#### Scenario: Create with skills
- **WHEN** a coach creates a game-model observation with `habilidades = ["Percepción", "Pase"]`
- **THEN** the system returns `201` with those two skills

#### Scenario: Invalid skills
- **WHEN** a skill is not in the vocabulary, a skill is repeated, or more than 5 are sent
- **THEN** the system returns a `400` `ValidationProblemDetails` response

#### Scenario: Attitude with skills
- **WHEN** an attitude observation is created with `habilidades`
- **THEN** the system returns a `400` `ValidationProblemDetails` response

### Requirement: Skills can be edited
`PUT …/observations/{observationId}` SHALL accept optional `habilidades` with the same vocabulary, uniqueness and maximum rules, replacing the observation's skills when sent and keeping them when omitted. Sending `habilidades` for an attitude observation SHALL return `400`.

#### Scenario: Replace skills
- **WHEN** a coach updates an observation with `habilidades = ["Desmarque"]`
- **THEN** the response contains only «Desmarque»

#### Scenario: Keep skills when omitted
- **WHEN** a coach updates only the assessment and comment
- **THEN** the observation keeps its previous skills

#### Scenario: Attitude update with skills
- **WHEN** `habilidades` are sent when updating an attitude observation
- **THEN** the system returns a `400` `ProblemDetails` response and nothing changes

### Requirement: The web lets coaches pick and see skills
The Coach web SHALL offer a «Habilidades (opcional)» multi-select of the vocabulary, limited to 5, in each Subprincipio block of the session form, in the standalone form and when editing a game-model observation, and SHALL show an observation's skills as chips on its card. Attitude blocks and attitude observations SHALL NOT offer skills.

#### Scenario: Pick skills in the session form
- **WHEN** the coach rates «Circular para desordenar» and picks «Percepción» and «Pase»
- **THEN** the saved request for that Subprincipio includes `habilidades = ["Percepción", "Pase"]`

#### Scenario: Limit of five
- **WHEN** five skills are already selected
- **THEN** the remaining options are disabled

#### Scenario: Card shows skills
- **WHEN** an observation has skills «Percepción» and «Pase»
- **THEN** its card shows both as chips

#### Scenario: No skills for attitude
- **WHEN** the coach edits an attitude observation or looks at an attitude block
- **THEN** no skills selector is shown
