## Purpose

Lets a coach talk with an assistant on the game-model page that asks clarifying questions and replies with a structured, validated change proposal, using the coach's own AI provider and a backend-built context that holds no identifying personal data.

## ADDED Requirements

### Requirement: The assistant is available only with write permission and an active provider
The game-model page SHALL offer the assistant only to users who have write permission on the game-model feature, and the backend SHALL reject an assistant request from any other user as forbidden. When the user has no active AI provider, the assistant button SHALL be disabled and a notice SHALL link to "Ajustes de IA".

#### Scenario: Coach with write permission and an active provider
- **WHEN** a user with write permission on the game-model feature and an active provider opens the game-model page
- **THEN** the assistant button is enabled

#### Scenario: No active provider
- **WHEN** a user with write permission and no active provider opens the game-model page
- **THEN** the assistant button is disabled and a notice links to "Ajustes de IA"

#### Scenario: Read-only user
- **WHEN** a user without write permission on the game-model feature sends an assistant request
- **THEN** the backend rejects it as forbidden and no provider is called

### Requirement: The conversation is held by the browser and never stored
The backend SHALL keep no conversation. The browser SHALL hold the on-screen conversation and SHALL send it with each assistant request. Closing the chat SHALL discard the conversation together with any pending proposal.

#### Scenario: Conversation sent with each request
- **WHEN** the coach sends a second message in the chat
- **THEN** the request carries the earlier messages of the conversation and the backend reads no stored history

#### Scenario: Closing the chat
- **WHEN** the coach closes the chat while a proposal is pending
- **THEN** the conversation and the pending proposal are discarded and nothing about them is stored

### Requirement: The assistant asks before it proposes
When the request is ambiguous, the assistant SHALL ask clarifying questions before it proposes, up to a maximum number of rounds. The maximum SHALL be one value read from system configuration, not fixed by this specification. After the maximum number of rounds, the assistant SHALL propose changes and SHALL state the assumptions it made.

#### Scenario: Ambiguous request
- **WHEN** the coach sends an ambiguous request and the maximum number of rounds is not reached
- **THEN** the assistant replies with a question and no changes

#### Scenario: Maximum rounds reached
- **WHEN** the assistant has already asked the maximum number of clarifying rounds and the request is still ambiguous
- **THEN** the assistant replies with a proposal whose message states its assumptions

#### Scenario: Maximum read from configuration
- **WHEN** the configured maximum number of clarifying rounds is changed
- **THEN** the assistant uses the new value for the next conversation without a code change

### Requirement: The assistant reply is a typed envelope validated against a closed schema
The assistant reply SHALL be an envelope with a kind (question or proposal), a message and a list of changes. Each change SHALL have an operation (add, change or remove), a node address and its fields. The backend SHALL validate the reply against a closed schema, using the provider's forced JSON schema output when the provider has it and the schema in the prompt otherwise. A reply that fails the schema SHALL be retried once; when it still fails, the user SHALL see an error, no cards SHALL appear and the model SHALL stay unchanged.

#### Scenario: Valid proposal
- **WHEN** the provider replies with a proposal envelope that matches the schema
- **THEN** the changes are passed on for validation against the model

#### Scenario: Invalid reply retried once
- **WHEN** the first provider reply fails the schema and the retry matches it
- **THEN** the retry reply is used

#### Scenario: Invalid reply twice
- **WHEN** both the first reply and the retry fail the schema
- **THEN** the user sees an error, no cards appear and the saved model is unchanged

#### Scenario: Question carries no changes
- **WHEN** the reply kind is question
- **THEN** the message is shown in the chat and no cards appear

### Requirement: The provider context is built by the backend from an allowlist
One backend component SHALL build the context sent to the provider from an allowlist of fields per source: the game model, objectives, sessions, forecasts, and each player's alias, injuries and physical condition. It SHALL be the only code that reads data for the provider, and the AI SHALL NOT query data itself. For each player injury, the allowlist SHALL hold only the injury type, the start date, the end date and the estimated recovery; the free-text description of an injury SHALL NOT be sent, because it can hold personal health detail. DNI, phone, email, full name and any other identifying personal data SHALL never be sent to the provider.

#### Scenario: Injury free text excluded
- **WHEN** the context is built for a player whose injury has a free-text description that names a person
- **THEN** the injury appears with its type, dates and estimated recovery, and the description text is not in the context

#### Scenario: Player data in the context
- **WHEN** the context is built for a team with players
- **THEN** each player appears by alias with injuries and physical condition, and no DNI, phone, email or full name appears

#### Scenario: A personal field added later
- **WHEN** a new personal field is added to the player data and is not in the allowlist
- **THEN** it is not sent to the provider

#### Scenario: Tests assert that identifying fields are absent
- **WHEN** the context builder is tested with a player that has DNI, phone, email and full name
- **THEN** the test asserts that none of those values is in the context

### Requirement: An oversized context fails instead of being truncated
When the context exceeds the limit of the model, the request SHALL fail with a clear message. The context SHALL NOT be truncated silently.

#### Scenario: Context over the limit
- **WHEN** the built context is larger than the model limit
- **THEN** the request fails with a clear message and no truncated context is sent

### Requirement: A provider error keeps the conversation on screen
A provider error during the chat (quota exceeded, invalid key or timeout) SHALL show a specific message for that failure. The conversation SHALL stay on screen so the user can retry.

#### Scenario: Quota exceeded
- **WHEN** the provider fails with `QuotaExceeded` during a chat
- **THEN** the user sees a message that names the exceeded quota and the conversation stays on screen

#### Scenario: Retry after an error
- **WHEN** the user retries after a provider error
- **THEN** the same conversation is sent again

### Requirement: The chat tells the coach what data leaves the app
The chat panel SHALL show a visible notice that the game model, objectives, sessions, forecasts and the alias, injuries and physical condition of the players are sent to the coach's own AI provider, and that identifying personal data is not sent.

#### Scenario: Notice visible
- **WHEN** the coach opens the chat
- **THEN** the notice about the categories of data sent to the provider is visible
