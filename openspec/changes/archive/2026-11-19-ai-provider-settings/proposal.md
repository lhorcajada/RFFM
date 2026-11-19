> **⚠ POST-HOC RECORD** — This proposal was backfilled after implementation against a user-supplied statement of intent. It describes a decision already made, not one being proposed.

## Why

The coach wants AI help to update the game model, and each user must bring their own AI provider, free tiers included. The provider settings must be reusable by any later AI feature and must not be tied to the game model. This change delivers the settings and an internal chat-completion service; it delivers no end-user AI feature.

## What Changes

- New per-user AI provider settings stored in `AppDbContext` (schema `app`, entity `AiProviderSetting`, migration `AddAiProviderSettings`).
- New authenticated endpoints under `/api/ai-providers`: list (`GET`), create (`POST`), edit (`PUT /{id}`), delete (`DELETE /{id}`), activate (`POST /{id}/activate`) and connection test (`POST /test`). Each command has a FluentValidation validator and errors return `ProblemDetails` with the new codes `AiProviderNotFound` and `AiProviderBaseUrlInvalid`.
- API keys are encrypted with ASP.NET Core Data Protection before they are persisted. Responses expose only a masked tail (`****` plus the last four characters). Editing without a new key keeps the stored key.
- The base URL must be `https`, without user info, and must not resolve to a private, loopback or link-local address. The check runs at save time, before each provider call, and again at connect time. Redirects are not followed.
- One internal `IAiChatCompletionService` sits in front of two adapters: a native Claude (Anthropic Messages API) adapter and an OpenAI-compatible adapter. Outgoing calls use typed `HttpClient` instances with a 30-second timeout. Failures are classified (invalid key, unreachable URL, unknown model, quota exceeded, timeout, provider error, invalid base URL, no active provider); provider response bodies are never copied into results.
- "Probar conexión" sends a minimal request through the same service and returns a classified result without creating or changing a provider. For a saved provider it can use the stored key.
- Deleting a team user's account also deletes that user's AI provider settings and stored keys.
- Frontend: new coach page "Ajustes de IA" (`/coach/ai-settings`) reached from the avatar menu (hidden in the federation app), with provider cards, a create/edit dialog with templates (Claude, OpenAI, Gemini gratuito, Otro compatible con OpenAI), activation, connection test and delete confirmation through `ConfirmDialog`. Calls go through `aiProviderService.ts` over the single Axios instance. New `es`/`en` error messages for the two error codes.
- Version bumps: API `1.63.0`, Front `1.142.0`.

## Capabilities

### New Capabilities

- `ai-provider-settings`: per-user AI provider configuration (create, edit, delete, activate), templates, encrypted and masked API keys, base URL protection, connection test, account-deletion cleanup and the "Ajustes de IA" page.
- `ai-chat-completion`: internal chat-completion service that routes a request to the user's active provider through a native Claude adapter or an OpenAI-compatible adapter and returns a classified result.

### Modified Capabilities

- None

## Impact

New files:
- `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/AiProviders/AiProviderSetting.cs`
- `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/AiProviders/AiProviderTemplates.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/AiSettings/ActivateAiProvider.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/AiSettings/AiProviderCommon.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/AiSettings/AiSettingsServiceCollectionExtensions.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/AiSettings/CreateAiProvider.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/AiSettings/DeleteAiProvider.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/AiSettings/GetAiProviders.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/AiSettings/TestAiProviderConnection.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/AiSettings/UpdateAiProvider.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/AiSettings/Services/AiApiKeyProtector.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/AiSettings/Services/AiBaseUrlGuard.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/AiSettings/Services/AiChat.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/AiSettings/Services/AiChatAdapters.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/AiSettings/Services/AiChatCompletionService.cs`
- `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/20261118194607_AddAiProviderSettings.cs` (and `.Designer.cs`)
- `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Entities/AiProviderSettingEntityConfiguration.cs`
- Backend tests: `AiProviderEndpointTests.cs`, `DeleteTeamUserAccountAiProvidersTests.cs`, `AiBaseUrlGuardTests.cs`, `AiChatAdaptersTests.cs`, `AiProviderHandlerTests.cs`, `AiProviderValidationTests.cs`
- `Front/src/apps/coach/pages/ai-settings/AiSettings.tsx` (and `.module.css`, `__tests__/AiSettings.test.tsx`)
- `Front/src/apps/coach/pages/ai-settings/aiProviderTemplates.ts`
- `Front/src/apps/coach/pages/ai-settings/components/AiProviderCard.tsx` (and `.module.css`)
- `Front/src/apps/coach/pages/ai-settings/components/AiProviderFormDialog.tsx` (and `.module.css`, `__tests__/AiProviderFormDialog.test.tsx`)
- `Front/src/apps/coach/services/aiProviderService.ts`
- `Front/src/shared/components/ui/AppHeader/__tests__/AppHeader.aiSettings.test.tsx`

Modified files:
- `Back/ExtractionApi/Directory.Build.props`
- `Back/ExtractionApi/src/RFFM.Api/DependencyInjection/ServiceCollectionExtensions.cs`
- `Back/ExtractionApi/src/RFFM.Api/Domain/ErrorCodes.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Users/Commands/DeleteTeamUserAccount.cs`
- `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/AppDbContextModelSnapshot.cs`
- `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs`
- `Front/package.json`
- `Front/src/apps/coach/routes.tsx`
- `Front/src/shared/components/ui/AppHeader/AppHeader.tsx`
- `Front/src/shared/i18n/locales/en/errors.json`
- `Front/src/shared/i18n/locales/es/errors.json`

Related published specs flagged as overlapping (not updated by this backfill): `openspec/specs/coach-team-user-management/spec.md` (account deletion), `openspec/specs/user-profile/spec.md` (avatar menu), `openspec/specs/spec.md` (coach routes and error-code catalog).

Out of scope: design.md, tasks.md, implementation.md — not generated by /sai-backfill
