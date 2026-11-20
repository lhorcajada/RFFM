## Why

The game-model form is slow and complex to write by hand. An assistant that talks with the coach and proposes validated changes lets the coach create and update the model by conversation, using their own AI provider.

## What Changes

- A chat assistant on the coach game-model page. It asks clarifying questions first, up to a maximum number of rounds, and then proposes changes to the model as a structured list and states its assumptions.
- The model reply is a typed envelope (kind question or proposal, a message, and a list of changes). Each change has an operation (add, change or remove), a node address and its fields. The backend validates it against a closed schema, retries once when it fails, and discards each change that does not fit the current model.
- A backend-built context for the provider, made from an allowlist of fields: game model, objectives, sessions, forecasts, and each player's alias, injuries and physical condition. Identifying personal data (DNI, phone, email, full name) is never sent. The AI does not query data itself.
- One card per node in the existing read view, accepted or rejected independently. A change that depends on another proposed change can be accepted only after its parent, and rejecting the parent rejects its dependents.
- Accepted changes are saved in one save through the existing game-model update. The game model gets a version marker, captured when the proposal is built, so a save after another change asks the coach to regenerate the proposal.
- The backend stores no conversation. Closing the chat discards it and any pending proposal.
- Only users with write permission on the game-model feature can use the assistant. With no active provider the assistant button is disabled and a notice links to "Ajustes de IA".
- No Word import and no `.docx` reading. A coach who wants Word content pastes it into the chat.

## Capabilities

### New Capabilities

- `game-model-ai-assistant`: the chat, the backend-built allowlisted context, the typed and validated reply envelope, access rules, provider errors, and the absence of stored conversations.
- `game-model-ai-proposals`: proposal cards in the read view, independent accept and reject with dependencies, validation against the current model, and one save with a staleness check.

### Modified Capabilities

- `game-model`: the game model carries a version marker that changes on every save, is returned when the model is read, and is checked on update when supplied.

## Impact

- Backend: a new assistant endpoint and its context builder in the game-model feature area, a consumer of the existing internal chat-completion service, a version marker on the game-model aggregate with a migration, and the update endpoint accepting an optional expected marker.
- Frontend: the coach game-model page gains the assistant chat panel and holds its conversation and pending changes; the read view renders cards for pending changes; the game-model service gains the assistant call and the version marker.
- External dependency: the user's own AI provider, reached only through the existing `IAiChatCompletionService`. Injury and physical-condition data (health data) leave the app for that provider.
- Depends on `ai-provider-settings` (provider settings and chat completion) and `game-model-reading-view` (node addresses and pending-change decoration), both already archived.

## Proposal Research Documentation

**Local files**:
- openspec/config.yaml
- GLOSSARY.md
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Commands/UpdateGameModel.cs - full-tree upsert, no version check, `ReadWrite` requirement, team-membership check
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Commands/CreateGameModel.cs - request validators, closed Habilidad vocabulary and set-piece subtypes
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Queries/GetGameModel.cs - response exposes node keys, no version field
- Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/GameModels/GameModelKeys.cs - stable keys for principles, subprincipios, zones and sub-subprincipios
- Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/GameModels/GameModel.cs - no timestamp or concurrency token
- Back/ExtractionApi/src/RFFM.Api/Domain/BaseEntity.cs - only id and domain events
- Back/ExtractionApi/src/RFFM.Api/Common/Behaviors/FeaturePermissionBehavior.cs - feature permission enforcement
- Back/ExtractionApi/src/RFFM.Api/Common/IRequireFeaturePermission.cs
- Back/ExtractionApi/src/RFFM.Api/Domain/ErrorCodes.cs - existing game-model error code naming
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Players/Player.cs - `Alias` and identifying fields
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/TeamPlayerInjury.cs - injury fields, free-text description
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Services/PlayerFatigueCalculator.cs - physical condition is computed, not stored
- Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Training/TrainingSession.cs - session fields and `ObjetivoGeneral`
- Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/GameModels/Nota.cs - note type `objetivo-temporada`
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Federation/Results/RffmRoundSimulation.cs - nearest match to a forecast
- Front/src/apps/coach/services/gameModelService.ts - API types and tree mappers
- Front/src/apps/coach/pages/game-model/GameModel.tsx - page, `canEdit` from the `ReadWrite` feature permission
- Front/src/apps/coach/pages/game-model/components/gameModelReadingTree.ts - `PendingChange` and `PendingChanges` types
- openspec/specs/game-model/spec.md
- openspec/specs/game-model-redesign/spec.md
- openspec/specs/game-model-reading-view/spec.md
- openspec/specs/ai-provider-settings/spec.md
- openspec/specs/ai-chat-completion/spec.md
- openspec/changes/archive/2026-11-19-game-model-reading-view/proposal.md
- openspec/changes/archive/2026-11-19-ai-provider-settings/proposal.md

**External URLs**:
- None

## Request Additional Notes

Undecided: the maximum number of clarifying rounds before the assistant proposes (affects E21).
Agreed context: the "Ajustes de IA" page should show which categories of data are sent to the provider; wording and placement are settled in design, because that page ships in ai-provider-settings.
If the change proves too large to review in one sitting, it can be cut into a backend part (context, envelope, endpoint) and a screen part (chat panel, cards, save).

## Additional Notes

- The existing update replaces the whole tree and removes nodes that are absent from the request, so the frontend must send the full tree with the accepted changes applied.
- The Habilidad name is a closed 15-value vocabulary and the set-piece subtype a closed list; the change schema must use them.
- The read response has node keys for principles, subprincipios, zones and sub-subprincipios, but not for skills (Habilidad). Skills and notes are addressed by id under their parent address in the read view.
- There is no dedicated season-objectives entity and no stored physical-condition entity. Objectives are held today as game-model notes of type `objetivo-temporada` and as the general objective of a training session; fatigue, form and readiness are computed on demand. Design decides which sources feed the "objectives" and "physical condition" context fields.
- The injury description is free text and may hold personal health detail, so the specs allowlist only the injury type, start date, end date and estimated recovery and exclude the description.
- Open question for design: the default maximum number of clarifying rounds (E21). The specs require one value read from system configuration and do not fix it.
- A reply with two changes for the same node keeps the first and discards the rest, counted in the discarded total.
- The game-model conflict on a stale marker is `409 Conflict` as `ProblemDetails` with the error code `GameModelStale`.
- The read endpoint requires `Read`, while the update requires `ReadWrite`. The assistant endpoint needs `ReadWrite`.
