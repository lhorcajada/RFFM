---
name: openspec-apply-change
description: Plan and execute an OpenSpec change by first writing an implement.md technical script, then delegating implementation to an economic implementer subagent. Use when the user wants to start implementing, continue implementation, or work through tasks.
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.1-custom"
  generatedBy: "1.5.0"
  customized: "Generates implement.md then delegates to openspec-implementer subagent (do not let `openspec update` overwrite this file without re-applying the customization)."
---

<!-- CUSTOMIZED SKILL — This file was customized for the RFFM project.
     Default openspec-apply-change implements tasks directly. Here it instead:
       1) Writes a self-contained implement.md script (run on a strong model).
       2) Delegates execution to the openspec-implementer subagent (economic model).
     If `openspec init`/`openspec update` regenerates this skill, re-apply this customization. -->

Plan and execute an OpenSpec change in two phases:

- **Phase A — Plan (you, strong model):** read the change artifacts and write `implement.md`, a self-contained technical script with checkable tasks for an economic AI.
- **Phase B — Delegate:** hand `implement.md` to the `openspec-implementer` subagent (economic model) and let it implement. You do **not** write production code yourself.

When implementation is done, the user can run `/opsx-verify` then archive.

---

**Store selection:** If the user names a store (a store is a standalone OpenSpec repo registered on this machine) or the work lives in one, run `openspec store list --json` to discover registered store ids, then pass `--store <id>` on the commands that read or write specs and changes (`new change`, `status`, `instructions`, `list`, `show`, `validate`, `archive`, `doctor`, `context`). Other commands do not take the flag. Hints printed by commands already carry the flag; keep it on follow-ups. Without a store, commands act on the nearest local `openspec/` root.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run `openspec list --json` to get available changes and use the **AskUserQuestion tool** to let the user select

   Always announce: "Using change: <name>" and how to override (e.g., `/opsx-apply <other>`).

2. **Check status to understand the schema**
   ```bash
   openspec status --change "<name>" --json
   ```
   Parse the JSON to understand:
   - `schemaName`: The workflow being used (e.g., "spec-driven")
   - `planningHome`, `changeRoot`, and `actionContext`: planning scope and edit constraints
   - Which artifact contains the tasks (typically "tasks" for spec-driven, check status for others)
   - Capture `changeRoot` — `implement.md` will be written there as `<changeRoot>/implement.md`.
   - Capture the tasks artifact path from `artifactPaths`/`contextFiles` so you can keep it in sync later.

   **Handle states:**
   - If `state: "blocked"` (missing artifacts): show message, suggest using openspec-propose / openspec-continue to finish artifacts first. Stop.
   - If `state: "all_done"`: congratulate, suggest archive. Stop.

3. **Get apply instructions**
   ```bash
   openspec instructions apply --change "<name>" --json
   ```
   This returns `contextFiles` (artifact ID → concrete file paths), progress, the task list with status, and a dynamic instruction.

4. **Read context files**

   Read every file path listed under `contextFiles`. For spec-driven that is typically: proposal, specs, design, tasks. Also read `.github/instructions/copilot-instructions.md` so you can embed the right conventions into `implement.md` (see Phase A).

5. **Show current progress**

   Display:
   - Schema being used
   - Progress: "N/M tasks complete"
   - Remaining tasks overview
   - Dynamic instruction from CLI

---

## Phase A — Write `implement.md` (you, strong model)

6. **Decide whether to (re)generate `implement.md`**

   - Path: `<changeRoot>/implement.md` (use the `changeRoot` from step 2; never assume a hardcoded path).
   - If `implement.md` already exists:
     - If it has unchecked `- [ ]` tasks → **reuse it**, do not regenerate. Skip to Phase B (step 8). Tell the user you are resuming from the existing script.
     - If all tasks are `- [x]` → suggest verifying/archiving. Stop.
     - Only regenerate if the user explicitly asks (e.g., "regenerate the script", or the artifacts changed). Before regenerating an existing file, read it and confirm with the user.
   - Otherwise, generate it now.

7. **Generate `implement.md`** — a self-contained technical script

   Use the **TodoWrite tool** to track generation. Write the file with the Write tool to `<changeRoot>/implement.md`. The script must be detailed enough that a cheap model can execute it **without** reading the proposal/design/specs again. Structure:

   ```markdown
   # implement.md — <change-name>

   > Generated by openspec-apply-change (strong model) for execution by the
   > openspec-implementer subagent (economic model). Follow tasks top-to-bottom;
   > check `- [ ]` → `- [x]` only after the task is done and verified.

   ## Goal
   <1–3 sentence summary of what this change delivers and why. Pull from the proposal.>

   ## Scope & touchpoints
   - Affected areas: <Front/ and/or Back/ExtractionApi/ — list specific folders/files>
   - Out of scope: <explicit non-goals from the proposal/design>

   ## Conventions to follow
   <Extract ONLY the conventions relevant to the touched areas from
   .github/instructions/copilot-instructions.md. For Backend: vertical-slice
   one-file feature, IFeatureModule, Mediator ICommand/IQueryApp, FluentValidation
   required on ICommand, ProblemDetails RFC 7807, SmartEnum, EF Core configs via
   reflection, the three DbContexts + connection keys, auth flow. For Frontend:
   CSS Modules co-located, MUI v5 + nested ThemeProvider, single Axios instance,
   React.lazy pages, no barrel re-exports, event bus for cross-app messaging,
   auth flow. Keep it condensed — the implementer also has the copilot file.>

   ## Implementation tasks
   - [ ] 1. <task title>
     - Files: <exact paths to create/modify>
     - What to do: <precise instructions; for a new backend feature, show the
       IFeatureModule skeleton and which CQRS interface to use; for a new React
       component, name the .tsx + co-located .module.css and which app folder>
     - Key details: <records/handlers/validators, DTOs, DB config, route paths,
       theme, event names — whatever the task needs>
     - Acceptance: <how to know this task is done>
   - [ ] 2. ...

   <Break the work into small, independently-verifiable tasks. One task = one
   checkable unit. Prefer many small tasks over a few big ones. If the OpenSpec
   tasks.md has higher-level tasks, map each implement.md task to its parent in
   a comment, e.g. "# maps to tasks.md: T2".>

   ## Verification
   Run from the right working directory after the relevant tasks and again at the end:
   - Backend (if Back/ touched): `cd Back/ExtractionApi; dotnet build` (+ tests if present)
   - Frontend (if Front/ touched): `cd Front; npm run build` (+ `npm run test` / `npx playwright test` if relevant)
   - Success criteria: <what a clean build/test means for this change>

   ## Notes for the implementer
   - <edge cases, ordering constraints, things that are easy to get wrong>
   - <do NOT commit; leave changes in the working tree>
   ```

   Guidelines for generating:
   - Be concrete and prescriptive: exact file paths, exact type/route names, exact patterns to mirror. The implementer should rarely need to make a design decision.
   - Inspect the nearest sibling files (e.g., an existing feature under `Back/ExtractionApi/src/RFFM.Api/Features/`, or an existing page under `Front/src/apps/<app>/`) and base the script on their real shape.
   - Keep `implement.md` self-contained but not bloated — reference `.github/instructions/copilot-instructions.md` for the full convention set instead of copying it wholesale.
   - Do NOT copy OpenSpec `<context>`/`<rules>`/`<project_context>` blocks into the file.
   - After writing, verify the file exists, then show: "Created implement.md at <path> with N tasks."

---

## Phase B — Delegate to the implementer subagent

8. **Launch the `openspec-implementer` subagent via the Task tool**

   Use the **Task tool** with:
   - `subagent_type`: `"openspec-implementer"`
   - `description`: `"Implement <change-name>"`
   - `prompt`: a detailed handoff containing:
     - The change name.
     - The absolute path to `implement.md`.
     - The absolute path to the OpenSpec `tasks.md` (so it can mark high-level items too).
     - The list of touched areas (Front/ and/or Back/) so it knows which verify commands apply.
     - An explicit instruction: "Read `implement.md` first, implement each unchecked task in order, check `- [ ]`→`[x]` in `implement.md` after each, keep `tasks.md` in sync, run the Verification commands, and return your Implementation Report. Do not redesign; follow the script. Pause and report if blocked."
   - Do **not** pass `task_id` unless you are intentionally resuming a prior implementer session; normal resume works via the checkboxes already persisted in `implement.md`.

   The implementer runs on the economic model and returns a single Implementation Report. Wait for it.

9. **Relay the implementer's report and reconcile state**

   When the implementer returns:
   - Show its Implementation Report to the user (completed / blocked / verification).
   - Re-run `openspec status --change "<name>" --json` to confirm the OpenSpec task progress the implementer recorded in `tasks.md`.
   - If blocked: present the implementer's blocker, offer options (fix the script and re-delegate, have the user intervene, or adjust artifacts). Do not silently override.
   - If all `implement.md` tasks are checked and verification passed: suggest running `/opsx-verify` then archiving.

**Output During Delegation**

```
## Executing: <change-name> (schema: <schema-name>)

Phase A: wrote implement.md (<path>) — N tasks defined.
Phase B: delegated to openspec-implementer (opencode/glm-4.6-flash).
Waiting for the implementer...
```

**Output On Completion**

```
## Implementation Complete
**Change:** <change-name>
**Schema:** <schema-name>
**implement.md progress:** M/M tasks complete ✓
**OpenSpec tasks.md progress:** N/N complete ✓

### Implementer report
<paste/summary of the implementer's report>

Verification passed. Next: run `/opsx-verify`, then archive.
```

**Output On Pause (Blocked)**

```
## Implementation Paused
**Change:** <change-name>
**implement.md progress:** K/M tasks complete

### Blocker
<implementer's blocker>

**Options:**
1. Update implement.md and re-delegate
2. You (user) resolve it manually
3. Adjust the OpenSpec artifacts
What would you like to do?
```

**Guardrails**
- You (the orchestrator) write `implement.md` and delegate. You do **not** write production code directly. The only file you create is `implement.md`.
- Always read context files before writing `implement.md`.
- Make `implement.md` self-contained and prescriptive — a cheap model should be able to follow it with no extra design decisions.
- Reuse an existing `implement.md` when it has pending tasks; only regenerate on explicit request or artifact change.
- Keep `implement.md` tasks small and independently checkable.
- The implementer does the coding, checkboxing, and verification; you relay and reconcile.
- If the implementer reports a blocker, do not guess past the script — surface it to the user.
- Never commit. Leave all changes for the user to review.

**Fluid Workflow Integration**

This skill supports the "actions on a change" model:
- **Can be invoked anytime**: after partial implementation, interleaved with other actions. Resume is driven by the checkboxes in `implement.md`.
- **Allows artifact updates**: if implementation reveals a design issue, update the OpenSpec artifacts and regenerate `implement.md` (with user confirmation) before re-delegating.
