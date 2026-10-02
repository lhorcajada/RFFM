## ADDED Requirements

### Requirement: Each team has a catalog of evaluable comments
The system SHALL expose `GET /api/teams/{teamId}/tracking-comments`, returning the team's comments (`id`, `title`, `description`) ordered by title, and `POST /api/teams/{teamId}/tracking-comments` with `{ title, description? }`, returning `201` with the created comment. The title SHALL be required, at most 100 characters and unique within the team ignoring case and surrounding spaces; the description SHALL be optional and at most 500 characters. Both endpoints SHALL require the Coach role, the `GameModel` feature permission (`Read` / `ReadWrite`) and team membership.

#### Scenario: Create and list
- **WHEN** a coach creates «Implicación defensiva» and «Paciencia con balón» in a team
- **THEN** the list of that team returns both ordered by title, and the list of another team does not include them

#### Scenario: Duplicated title
- **WHEN** a coach creates « implicación DEFENSIVA » in a team that already has «Implicación defensiva»
- **THEN** the system returns `409` with code `TrackingCommentDuplicated`

#### Scenario: Invalid comment
- **WHEN** the title is empty or longer than 100 characters, or the description is longer than 500
- **THEN** the system returns `400`

#### Scenario: Non-coach roles are forbidden
- **WHEN** a Player, FamilyMember, ClubDirector, ClubMember or Administrator calls either endpoint
- **THEN** the system returns `403`

### Requirement: Session evaluations can assess catalog comments
`PUT /api/teams/{teamId}/players/{teamPlayerId}/session-evaluations/{sessionId}` SHALL accept `comments: [{ trackingCommentId, assessment, note? }]` referencing comments of the team's catalog, with an assessment `Achieved`, `Partial` or `NotAchieved` and an optional note of at most 500 characters. An evaluation SHALL contain at least one Subprincipio item or one comment item, and a comment SHALL not be repeated. Each comment item SHALL store the comment title at that time. `GET` of the evaluation SHALL return the comment items, and the session list summary SHALL count the assessments of both Subprincipio and comment items.

#### Scenario: Evaluation with comments
- **WHEN** a coach saves an evaluation with one Subprincipio and the comment «Implicación defensiva» as `NotAchieved` with note «Pregunta si vamos a hacer eso todo el entreno»
- **THEN** the response contains the comment with its title, assessment and note

#### Scenario: Only comments
- **WHEN** a coach saves an evaluation with no Subprincipio items and one comment item
- **THEN** the evaluation is saved

#### Scenario: Nothing assessed
- **WHEN** both lists are empty
- **THEN** the system returns a `400` `ValidationProblemDetails` response

#### Scenario: Comment of another team
- **WHEN** a comment item references a comment of another team
- **THEN** the system returns `404` with code `TrackingCommentNotFound` and nothing is saved

#### Scenario: Summary counts comments
- **WHEN** an evaluation has one Subprincipio `Partial` and one comment `NotAchieved`
- **THEN** the session list summary returns `partial = 1` and `notAchieved = 1`

#### Scenario: Catalog comment removed
- **WHEN** a catalog comment used in an evaluation is deleted
- **THEN** the comment item keeps its title with `trackingCommentId = null`
