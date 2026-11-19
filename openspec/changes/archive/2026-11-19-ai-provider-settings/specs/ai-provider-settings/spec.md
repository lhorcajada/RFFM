## ADDED Requirements

### Requirement: Manage per-user AI providers

The system SHALL let an authenticated user list, create, edit and delete their own AI provider settings through `/api/ai-providers`. A provider SHALL store a template (`claude`, `openai`, `gemini` or `custom`), a base URL, a model and an API key. The list SHALL return only the current user's providers, ordered by creation time.

#### Scenario: Create a provider
- **WHEN** an authenticated user sends `POST /api/ai-providers` with a known template, an `https` base URL, an API key and a model
- **THEN** the system stores the provider for that user and returns `201 Created` with the provider data

#### Scenario: Another user's provider is not visible
- **WHEN** a user lists, edits, deletes, activates or tests a provider id that belongs to a different user
- **THEN** the list does not include it and the other operations return `404 Not Found` as `ProblemDetails` with code `AiProviderNotFound`

### Requirement: Reject incomplete provider data

The system MUST reject a create, edit or connection-test request that lacks a template, a base URL or a model, or a create request that lacks an API key, with a validation error whose message names the missing field. An unknown template, a base URL longer than 500 characters, a model longer than 200 characters, or an API key shorter than 8 or longer than 500 characters MUST also be rejected.

#### Scenario: Missing model
- **WHEN** a user saves a provider without a model
- **THEN** the system returns `400 Bad Request` with the message "El modelo es obligatorio." and stores nothing

### Requirement: Store API keys encrypted and never return them

The system SHALL encrypt every API key with ASP.NET Core Data Protection before it is persisted. No endpoint SHALL return the API key; responses SHALL expose only a masked value made of `****` followed by the last four characters of the key. Editing a provider without a new API key SHALL keep the stored key.

#### Scenario: Masked key in responses
- **WHEN** a user saves a provider with the key `sk-abcdef123456`
- **THEN** the response and later list results show `****3456` and never the full key

#### Scenario: Edit keeps the stored key
- **WHEN** a user edits a provider and leaves the API key empty
- **THEN** the system updates the other fields and keeps the previously stored encrypted key

### Requirement: Protect the provider base URL

The system MUST reject a base URL that is not an absolute `https` URL or that carries user info. On save, the system MUST reject a base URL whose host resolves to a private, loopback, link-local, carrier-grade NAT, unspecified or multicast address with `ProblemDetails` code `AiProviderBaseUrlInvalid`. Outgoing provider calls MUST NOT follow redirects and MUST check the destination address again at connect time.

#### Scenario: Private address rejected
- **WHEN** a user saves a provider whose base URL host resolves to `10.0.0.5`
- **THEN** the system rejects the request with code `AiProviderBaseUrlInvalid` and stores nothing

#### Scenario: Non-https URL rejected
- **WHEN** a user saves a provider with base URL `http://api.example.com`
- **THEN** the system returns a validation error "La URL base debe ser una dirección https válida."

### Requirement: Mark one provider as active

The system SHALL let a user mark one of their providers as active through `POST /api/ai-providers/{id}/activate`; every other provider of that user SHALL become inactive. Deleting the active provider SHALL leave the user with no active provider. No app-wide default provider SHALL exist.

#### Scenario: Activate a provider
- **WHEN** a user with providers A (active) and B activates B
- **THEN** B is active and A is inactive

#### Scenario: Delete the active provider
- **WHEN** a user deletes their active provider
- **THEN** none of their remaining providers is active

### Requirement: Test a provider connection

The system SHALL provide `POST /api/ai-providers/test` ("Probar conexión"), which sends a minimal request through the chat-completion service with the supplied settings and returns `success`, a `failure` name and a Spanish `message`. A failure SHALL be classified as invalid key, unreachable URL, unknown model, quota exceeded, timeout, invalid base URL or provider error. When the request carries the id of the user's saved provider and no API key, the stored key SHALL be used. The test MUST NOT create or modify any provider.

#### Scenario: Invalid key reported
- **WHEN** a user tests a provider and the provider answers `401 Unauthorized`
- **THEN** the result has `success: false`, `failure: InvalidKey` and the message "La clave de API no es válida." and no provider is created or changed

#### Scenario: Test with stored key
- **WHEN** a user tests a saved provider with its id and an empty API key
- **THEN** the system decrypts and uses that provider's stored key

### Requirement: Remove AI providers when a user account is deleted

When a team user's account is deleted, the system SHALL delete every AI provider setting of that user, including the stored encrypted keys.

#### Scenario: Account deletion removes providers
- **WHEN** a coach deletes the account of a team user who has AI providers
- **THEN** no AI provider setting of that user remains

### Requirement: AI settings page in the coach app

The coach app SHALL provide an "Ajustes de IA" page at `/coach/ai-settings`, reached from the avatar menu item "Ajustes de IA", which SHALL NOT appear in the federation app. The page SHALL show each provider as a card with its template label, model, base URL, masked key and an "Activo" chip when active, plus "Activar", "Probar conexión", "Editar" and "Eliminar" actions. A create/edit dialog SHALL offer the templates Claude (Anthropic), OpenAI, Gemini (gratuito) and Otro (compatible con OpenAI), prefilling base URL and model from the template. Deletion SHALL ask for confirmation through `ConfirmDialog`. The page SHALL show loading, error with retry, and empty states.

#### Scenario: Gemini template prefill
- **WHEN** the user selects "Gemini (gratuito)" in the dialog
- **THEN** the base URL is set to `https://generativelanguage.googleapis.com/v1beta/openai`, the model to `gemini-2.0-flash`, and a hint warns that the free plan has a limited quota

#### Scenario: Menu entry hidden in federation
- **WHEN** a user opens the avatar menu in the federation app
- **THEN** the "Ajustes de IA" item is not shown
