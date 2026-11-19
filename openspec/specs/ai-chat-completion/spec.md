# ai-chat-completion Specification

## Purpose
TBD - created by archiving change ai-provider-settings. Update Purpose after archive.
## Requirements
### Requirement: Internal chat-completion service

The backend SHALL expose one internal `IAiChatCompletionService` that completes a chat request, as a list of role-tagged messages with an optional maximum token count, either with the user's active provider or with explicit credentials. Callers SHALL NOT need to know which provider answers. When the user has no active provider, the service SHALL return the failure `NoActiveProvider` without calling any provider.

#### Scenario: No active provider
- **WHEN** a feature calls the service for a user with no active provider
- **THEN** the result fails with `NoActiveProvider` and no outgoing request is made

#### Scenario: Active provider used
- **WHEN** a feature calls the service for a user whose active provider uses the `gemini` template
- **THEN** the service decrypts the stored key and sends the request through the OpenAI-compatible adapter

### Requirement: Two provider adapters

The service SHALL route requests of the `claude` template to a native Anthropic Messages API adapter and requests of every other template to an OpenAI-compatible chat-completions adapter that takes base URL, key and model. Templates SHALL be preset values, not separate adapters. Outgoing calls SHALL use typed `HttpClient` instances with a 30-second timeout.

#### Scenario: Claude request shape
- **WHEN** the service sends a request with a system message through the Claude adapter
- **THEN** the call goes to `/v1/messages` with the `x-api-key` and `anthropic-version` headers and the system text in the `system` field

#### Scenario: OpenAI-compatible request shape
- **WHEN** the service sends a request through the OpenAI-compatible adapter with base URL `https://api.openai.com/v1`
- **THEN** the call goes to `https://api.openai.com/v1/chat/completions` with a `Bearer` authorization header

### Requirement: Classified results without leaking provider data

The service MUST return a classified result instead of throwing: `InvalidKey` for `401`/`403` or a key error, `QuotaExceeded` for `429`, `Timeout` for a timeout or `408`/`504`, `UnknownModel` for a model error, `Unreachable` for a connection failure, an unresolvable host or a redirect, `InvalidBaseUrl` for a blocked URL, and `ProviderError` otherwise. The provider response body MUST NOT be copied into the result, and the API key MUST NOT appear in a result, message or log text.

#### Scenario: Quota exceeded
- **WHEN** the provider answers `429 Too Many Requests`
- **THEN** the result fails with `QuotaExceeded`

#### Scenario: Redirect not followed
- **WHEN** the provider answers with a `302` redirect
- **THEN** the redirect is not followed and the result fails with `Unreachable`

