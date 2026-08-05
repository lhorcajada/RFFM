## Context

Today `Team` (`Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/Team.cs`) has a nullable `RulesDocumentUrl` string, populated by `Features/Mobile/Teams/Commands/UploadTeamRulesDocument.cs` (Coach/Admin, multipart PDF upload, `IStorageService.UploadAsync`) and read by `Features/Mobile/Teams/Queries/GetTeamRulesDocument.cs` (any team member, `Results.File`). Mobile's `TeamRulesScreen.tsx` downloads the bytes, caches them locally, and renders them through a bundled PDF.js viewer (`src/pdfViewer/`) inside a `react-native-webview` because Android's WebView has no native PDF renderer. `Front/` has no equivalent screen at all.

One real team currently has a rules PDF: `RulesDocumentUrl = "team-rules-documents/597fd359-01e1-4b29-b6e7-c56efd9fbd48.pdf"` (confirmed via `LocalStorageService.UploadAsync`'s `"{bucket}/{filePath}"` return shape — `Storage:UseLocal: true` in this environment, base folder `coaches-storage/`). Its content was extracted for this design (see Appendix A) and is a "FEPE CADETE" team's 10-rule document for the 2026-27 season, structured as a summary table (rule/violation/consequence) followed by one long-form section per rule (highlight phrase, description, optional bullet points, optional consequence detail), plus an intro note, a closing note about the team fund, and an "aplicación de las normas" paragraph.

This design also has a strong in-repo precedent for "ordered child list edited as one aggregate save": `GameModel → GamePrinciple → GameScenario` (see `Domain/Aggregates/GameModels/GamePrinciple.cs`, and `Features/Coaches/GameModels/Commands/UpdateGameModel.cs`'s full-model `PUT`). The most recent change in this codebase (`archive/2026-08-04-restructure-game-model-principles`) explicitly treats "create, edit, and delete children via the full aggregate PUT" as satisfying a CRUD requirement — the same shape fits here.

## Goals / Non-Goals

**Goals:**
- Replace the PDF flow end-to-end: no more file upload/download/rendering for team rules, anywhere.
- One `TeamRulesSet` per `Team` (0 or 1), containing ordered `TeamRule`s, editable as a whole by Coach/Admin from both Front (Coach app) and Mobile.
- Any team member (Player/FamilyMember/Coach/Admin) can read the structured rules from Mobile.
- Migrate the one real team's PDF content into the new structure so no data is lost, then drop `RulesDocumentUrl`.
- Follow existing conventions exactly: vertical slice, `IRequireFeaturePermission`/`IRequireTeamMembership`, FluentValidation, `ProblemDetails`, CSS Modules + MUI theme (Front), `useAuth()`/data-loading pattern (Mobile).

**Non-Goals:**
- No versioning/history of rule changes — edits overwrite in place (mirrors `UpdateGameModel`).
- No per-role visibility on individual rules — if the set exists, every team member reads all of it.
- No orphan-blob cleanup for the old PDF files in storage — out of scope, noted as a risk.
- No shared type/validation package between Front and Mobile — each implements its own per `.claude/rules/frontend-architecture.md` §1.
- No migration UI/tool for other teams' PDFs (there is only one) — this is a one-time, one-team data migration.

## Decisions

### 1. Domain model: `TeamRulesSet` (1:1 with `Team`) + ordered `TeamRule` children

```
Team (existing)
  └─ TeamRulesSet? (0..1, unique FK TeamId)        table: TeamRulesSets, schema app
       Title              string, required, e.g. "NORMAS DE EQUIPO"
       Subtitle           string, required, e.g. "Compromiso, respeto y equipo"
       IntroNote          string, required (free text)
       ClosingNote        string?, nullable (free text, "aportaciones" note)
       ApplicationNote    string?, nullable (free text, "aplicación de las normas")
       Rules: List<TeamRule>
       └─ TeamRule (1..n, FK TeamRulesSetId)        table: TeamRules, schema app
            Order                int, required, contiguous 1..N
            ShortTitle           string, required, e.g. "Asistencia y preparación"
            Highlight            string?, nullable, e.g. "Entrenar suma preparación..."
            ViolationSummary     string, required (table-view cell)
            ConsequenceSummary   string, required (table-view cell)
            LongDescription      string?, nullable
            BulletPoints         List<string>?, nullable (jsonb column)
            ConsequenceDetail    string?, nullable
```

Rejected: embedding `Rules` directly on `Team` without a `TeamRulesSet` wrapper — rejected because the metadata fields (title/subtitle/notes) need a natural owner distinct from `Team` itself (mirrors `GameModel` sitting between `Team` and its principles, not fields bolted onto `Team`), and because "does a rules set exist yet" (nullable presence) is cleaner to express as a nullable navigation than as a nullable-metadata-plus-empty-list state on `Team`.

`BulletPoints` as a `List<string>` mapped to a `jsonb` column (`HasConversion` to/from `JsonSerializer`, `.Metadata.SetValueComparer(...)`) rather than a child table — precedented by `MatchParticipation`'s `Cards` JSON column (`Infrastructure/Persistence/Configuration/Entities/MatchParticipationEntityConfiguration.cs`) and `TaskTrainingBaseEntityConfiguration.cs`. A dedicated `TeamRuleBullet` child table was rejected: bullets are unordered-enough free text with no independent identity or behavior, so a JSON list keeps the schema flat, consistent with the existing `Cards` precedent, and avoids a fourth table for a field this simple.

Entity methods (rich domain, mirroring `GamePrinciple`/`Team`'s intention methods): `TeamRulesSet.Create(teamId, title, subtitle, introNote, closingNote, applicationNote)`, `UpdateMetadata(...)`, `ReplaceRules(IEnumerable<TeamRuleInput>)` (clears and rebuilds `Rules` with contiguous `Order`, used by the full-set `PUT`). `TeamRule` stays a plain child record constructed by `TeamRulesSet.ReplaceRules` — no independent factory, matching `GameScenario`'s ownership by `GamePrinciple`.

### 2. Endpoints: shared command/query, two route namespaces

Both Front (Coach app, `api/coaches/*`) and Mobile (`api/mobile/*`) need to write; only Mobile needs the "any team member" read (Front's Coach app reads it too, but only to pre-fill the edit form — same query). Neither app currently calls into the other's route namespace (`Front/` never calls `api/mobile/*`; `Mobile/` never calls `api/coaches/*`), so rather than break that separation, the command/query/handler/validator are defined once in `Features/Mobile/Teams/` (where this feature already lives) and a second, thin `IFeatureModule` in `Features/Coaches/Teams/` registers the `api/coaches/*` routes against the *same* Mediator request types. This avoids duplicating business logic while keeping each app's route namespace consistent with its existing calling convention.

Rejected: a single shared route consumed by both apps — rejected because it would be the first case of either app calling into the other's namespace, a bigger convention change than this feature warrants, and `.claude/rules/frontend-architecture.md` explicitly keeps `Front`/`Mobile` API surfaces independent per-consumer.

Endpoints (both namespaces, identical shape):
- `GET api/mobile/teams/{teamId}/rules` / `GET api/coaches/teams/{teamId}/rules` — `GetTeamRulesQuery : IQueryApp<TeamRulesDto?>, IRequireTeamMembership` (no `IRequireFeaturePermission` — every team member reads). `200` with the full structured payload, `204` if the team has no rules set yet, `404` if the team doesn't exist.
- `PUT api/mobile/teams/{teamId}/rules` / `PUT api/coaches/teams/{teamId}/rules` — `SaveTeamRulesCommand : IRequest<TeamRulesDto>, IRequireFeaturePermission, IRequireTeamMembership` (`FeatureRoute => CoachFeatureRoutes.TeamRulesDocument`, kept as-is — see Decision 4 — `RequiredPermission => "ReadWrite"`). Upserts: creates the `TeamRulesSet` if absent, otherwise replaces metadata and calls `ReplaceRules` with the full ordered list from the request body. `200` with the resulting `TeamRulesDto`. This single full-aggregate save is what gives Coach/Admin create/edit/reorder/delete-a-rule capability, exactly as `PUT /api/game-models/{id}` does for `GamePrinciple`/`GameScenario`.
- `DELETE api/mobile/teams/{teamId}/rules` / `DELETE api/coaches/teams/{teamId}/rules` — `DeleteTeamRulesCommand : IRequest, IRequireFeaturePermission, IRequireTeamMembership` (same permission). Removes the entire `TeamRulesSet` (cascade-deletes its `TeamRule`s), returning the team to "no rules published". `204` on success, `204` also if none existed (idempotent delete, matching REST conventions in `.claude/rules/dotnet.md` §7).

`TeamRulesDto`: `{ TeamId, Title, Subtitle, IntroNote, ClosingNote, ApplicationNote, Rules: [{ Id, Order, ShortTitle, Highlight, ViolationSummary, ConsequenceSummary, LongDescription, BulletPoints, ConsequenceDetail }], UpdatedAt }`.

Validator (`SaveTeamRulesCommand`): `Title`/`Subtitle`/`IntroNote` required (max lengths TBD at implementation, follow existing `ValidationConstants` sizing conventions); `Rules` non-empty; each rule's `ShortTitle`/`ViolationSummary`/`ConsequenceSummary` required; `Order` values contiguous starting at 1 (or re-derived server-side from array position, simpler — **implementation decision**: derive `Order` from array index server-side rather than trusting client-sent `Order`, removing a whole class of validation).

### 3. Feature-permission route: keep `CoachFeatureRoutes.TeamRulesDocument` constant and its `"/mobile/team-rules"` value unchanged

Renaming the `FeatureRoute` string would orphan any already-seeded `FeaturePermission` rows in the database that reference `"/mobile/team-rules"` for existing Coach/Admin users (silently revoking their access post-deploy). The C# constant is kept as-is too (only its doc comment updated) to avoid a no-op rename churning the diff — a follow-up cosmetic rename can happen independently if desired, but is not part of this change.

### 4. Data migration: single-team seed, resolved via SQL match on the known `RulesDocumentUrl`, then column drop

The migration's `Up()`:
1. Creates `TeamRulesSets` and `TeamRules` tables (schema `app`), FKs, `jsonb` column for `BulletPoints`.
2. Runs a data migration (raw SQL via `migrationBuilder.Sql(...)`, following the pattern of other data-bearing migrations in this project) that:
   - Looks up the team: `SELECT "Id" FROM app."Teams" WHERE "RulesDocumentUrl" = 'team-rules-documents/597fd359-01e1-4b29-b6e7-c56efd9fbd48.pdf'`.
   - If found, inserts one `TeamRulesSets` row (new GUID id, that `TeamId`, the metadata from Appendix A) and 10 `TeamRules` rows (Appendix A) referencing it.
   - Is a no-op (inserts nothing) if no team matches — safe for any environment where that specific team/URL doesn't exist (e.g., CI, a fresh DB, or if the URL has since changed).
3. Drops the `RulesDocumentUrl` column from `Teams`.

**Important caveat, flagged for implementation**: this planning session could not open a live connection to the project's Postgres instance (no `CatalogConnection`/`FutbolBaseConnection` value found in committed `appsettings.*.json` or the local `dotnet user-secrets` stores checked) to confirm the target team's `Id`/`Name` ahead of time. `tasks.md` includes an explicit task to run the `SELECT` above against the real dev database before finalizing the migration's literal `INSERT` values, and to sanity-check the result (team name should read like "FEPE CADETE" or similar) before merging. The migration is written to be self-verifying regardless (it matches on the exact stored URL, not a guess), so this is a confirmation step, not a design gap.

Alternative considered: an idempotent C# `IHostedService`/startup seeder instead of a SQL data migration — rejected, inconsistent with this project's precedent (`archive/2026-08-04-restructure-game-model-principles`'s scenario→principle backfill was also a migration-embedded data step, not a hosted service).

### 5. Front (`Front/`, app `coach`): new page under team management, full-form editor

New route `apps/coach/pages/team-rules/TeamRules.tsx` (list/read view: metadata + rule cards in order) and `TeamRulesEdit.tsx` (form: metadata fields + a reorderable list of rule editors — add/remove/reorder rows, each row expanding to its full field set), mirroring the `GameModel.tsx`/`GameModelCreate.tsx` split (separate read and create/edit pages, both gated by `RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.TeamRulesDocument}` in `routes.tsx`). New `apps/coach/services/teamRulesService.ts` (typed `getTeamRules`/`saveTeamRules`/`deleteTeamRules` against `api/coaches/teams/{teamId}/rules`, response `type`s per `.claude/rules/react.md` §2). Reordering uses a simple up/down control per row (no drag-and-drop library) — consistent with "no new dependency without justification" (`.claude/rules/react.md` §9) and sufficient for a ~10-row list. Reachable from the team management/dashboard area where "Normas del equipo" would naturally sit next to other team-scoped settings — exact entry point (team-dashboard vs settings) confirmed against the current `apps/coach/pages/team-dashboard/` / `apps/coach/pages/settings/` structure at implementation time.

### 6. Mobile: `TeamRulesScreen.tsx` renders structured data; new edit flow

`TeamRulesScreen.tsx` keeps its existing `loading/error/data` skeleton and `COACH_ADMIN_ROLES` gate, but:
- Fetches `TeamRulesDto` via a new `src/api/teamRules.ts` (`getTeamRules`, `saveTeamRules`, `deleteTeamRules` — replaces `teamRulesDocument.ts`), no bytes/local files involved.
- Empty state unchanged ("Aún no disponible") when `data === null` (204).
- Read view: intro note, then each rule as a card (`ShortTitle` + `Highlight` header, `ViolationSummary`/`ConsequenceSummary` as a compact two-line summary, expandable to `LongDescription`/`BulletPoints`/`ConsequenceDetail`), then closing/application notes. Plain `View`/`Text`/`FlatList` — no `WebView`.
- Coach/Admin sees an "Editar normas" control navigating to a new `TeamRulesEditScreen.tsx` (metadata fields + add/edit/delete/reorder rule rows, same up/down reorder approach as Front for consistency), `PUT`s the full set on save. A "Eliminar normas" destructive action (confirmation dialog) calls `DELETE`.
- Navigation: same slot in `TeamTabStack`/`TeamMenuScreen.tsx` as before (`RulesTab` `name` and menu entry unchanged — only the destination screen's internals change, per `.claude/rules/react-native.md` §3's stable-`name` rule); `TeamRulesEditScreen` added as a sibling stack screen reachable only from `TeamRulesScreen`.

### 7. Dependency removal: `react-native-webview`, `expo-document-picker`, `expo-file-system`, `src/pdfViewer/`

Confirmed via repo-wide search that these three packages and the `src/pdfViewer/` module are referenced **only** by the team-rules-document feature (`teamRulesDocument.ts`, `TeamRulesScreen.tsx`, the `pdfViewer/*` files themselves, and their own tests) — no other screen uses a PDF viewer, document picker, or the file-system module. Once the new screen ships, these become dead code. Removal (uninstall + delete `src/pdfViewer/`, its generated assets, its manual Jest mock in `jest.config.js`/`__mocks__/react-native-webview.js`) is included in `tasks.md` but flagged for explicit user approval before `npm uninstall` runs, per this agent's scope.

## Risks / Trade-offs

- **[Risk] Data migration targets one team by exact stored URL string, confirmed against a live DB only at implementation time, not in this planning session** → **Mitigation**: migration SQL is a no-op (not an error) if the URL doesn't match anything; `tasks.md` requires running and eyeballing the `SELECT` before merging; the migration is reversible in `Down()` by re-adding the column (data in the new tables is not automatically converted back — acceptable for a one-way data migration, consistent with the game-model precedent).
- **[Risk] Full-aggregate `PUT` for the rules list means two concurrent Coach edits (Front + Mobile) can silently overwrite each other** → **Mitigation**: same trade-off already accepted for `UpdateGameModel`; no optimistic concurrency token added, consistent with existing precedent, not a regression this change introduces.
- **[Risk] Dropping `RulesDocumentUrl` and the old endpoints is a breaking change for any already-shipped Mobile client build still calling the old routes** → **Mitigation**: acceptable per explicit user direction ("eliminar el flujo de subida/descarga de PDF"); both endpoints return `404` for unknown routes post-deploy, which is the expected outcome of an intentional removal, not a bug.
- **[Risk] Removing `react-native-webview`/`expo-document-picker`/`expo-file-system` could affect something not caught by the repo-wide grep (e.g., dynamic imports)** → **Mitigation**: `tasks.md` re-runs the search immediately before uninstalling, as a final check, not just at design time.
- **[Trade-off] No shared TypeScript types between Front and Mobile for the rules DTO** → accepted per `.claude/rules/frontend-architecture.md` §1 (no cross-tree imports); each defines its own `TeamRules`/`TeamRule` type in its service file.

## Open Questions

- Exact placement of the Front "Normas del equipo" entry point (team-dashboard vs settings vs a new team-management section) — resolved at implementation time by inspecting `apps/coach/pages/team-dashboard/` and `apps/coach/pages/settings/` for the closest existing "team-scoped configuration" pattern.
- Max lengths for the new string fields (`Title`, `ShortTitle`, `LongDescription`, etc.) — follow the sizing convention already used for `Team`/`GamePrinciple` (`ValidationConstants`), finalized when the validator is written.
- Whether to actively delete the orphaned PDF blob for the migrated team from storage as part of the migration — left out of scope per Non-Goals; can be a manual cleanup step if desired.

## Appendix A — Seed data for the migrated team (FEPE CADETE, Temporada 2026-27)

Extracted from `coaches-storage/team-rules-documents/597fd359-01e1-4b29-b6e7-c56efd9fbd48.pdf`.

**Metadata:**
- `Title`: "NORMAS DE EQUIPO"
- `Subtitle`: "Compromiso, respeto y equipo"
- `IntroNote`: "Nota inicial: las consecuencias tendrán una finalidad educativa, se aplicarán con proporcionalidad y, cuando sea necesario, se comunicarán a las familias. Las aportaciones económicas serán simbólicas y destinadas al fondo del equipo."
- `ClosingNote`: "Nota sobre aportaciones al fondo del equipo: si un jugador acumula 3€ pendientes y no los regulariza, no jugará el siguiente partido hasta resolver la situación. Esta medida se aplicará con comunicación previa a la familia y manteniendo siempre un criterio educativo y proporcional."
- `ApplicationNote`: "El incumplimiento de estas normas tendrá consecuencias educativas y/o deportivas, determinadas por el entrenador atendiendo a la gravedad, la reiteración, las circunstancias y la actitud del jugador. Las aportaciones económicas previstas expresamente serán de obligado cumplimiento. En los casos graves o reiterados se informará a las familias y, si procede, al club."

**Rules (Order, ShortTitle, Highlight, ViolationSummary, ConsequenceSummary, LongDescription, BulletPoints, ConsequenceDetail):**

1. **Asistencia y preparación** — *"Entrenar suma preparación, compromiso y prioridad deportiva."* — Violation: "No entrenar, entrenar solo un día o faltar parte de la pretemporada." — Consequence: "Podrá afectar a la convocatoria, minutos o prioridad deportiva, según las circunstancias." — Description: "El equipo entrena dos días a la semana. Las faltas deben avisarse con antelación y justificarse. La asistencia regular ayuda a mejorar la preparación, el ritmo y el compromiso con el grupo." — Bullets: ["Asistencia semanal: entrenar con regularidad podrá influir en la convocatoria, minutos o prioridad deportiva.", "Ausencias justificadas: no se considerarán falta de disciplina, pero podrán afectar a la preparación acumulada.", "Recuperación de prioridad: se valorará la asistencia posterior, la actitud y el compromiso mostrado en los entrenamientos."] — ConsequenceDetail: null.
2. **Compromiso con la convocatoria y el equipo** — *"Ser convocado implica responsabilidad, asistencia y actitud de grupo."* — Violation: "No avisar, avisar tarde, plan familiar previsto o causa de fuerza mayor." — Consequence: "Podrá afectar a la siguiente convocatoria o participación, según las circunstancias." — Description: "El jugador convocado debe confirmar su disponibilidad cuando se le solicite, acudir con puntualidad y mantener una actitud positiva durante todo el partido, tanto si juega muchos minutos como si participa menos. Formar parte del equipo significa animar, respetar las decisiones del entrenador y estar preparado para ayudar cuando sea necesario." — Bullets: null — ConsequenceDetail: "El incumplimiento podrá afectar a la siguiente convocatoria, titularidad o participación, siempre atendiendo a las circunstancias y a la comunicación realizada por la familia."
3. **Puntualidad** — *"Llegar a tiempo es una muestra de respeto al equipo."* — Violation: "Llegar tarde sin justificación." — Consequence: "Aportar 1€ al fondo del equipo." — Description: "El jugador debe llegar a la hora indicada y preparado para empezar." — Bullets: null — ConsequenceDetail: "Si llega tarde sin justificación, deberá aportar 1€ al fondo del equipo."
4. **Esfuerzo durante todo el entrenamiento** — *"La actitud y la intensidad forman parte del compromiso."* — Violation: "Falta de atención, de intensidad o participación en una sesión." — Consequence: "Podrá aplicarse una medida deportiva o educativa según la actitud, gravedad o reiteración." — Description: "El jugador debe realizar los ejercicios con atención, intensidad y respeto al trabajo del grupo. Se valorará la actitud general, la participación y la respuesta a las indicaciones del entrenador." — Bullets: null — ConsequenceDetail: "Cuando la falta de esfuerzo sea clara o reiterada, podrá aplicarse una medida deportiva o educativa según la actitud, la gravedad y la repetición de la conducta. Cuando proceda, también podrá implicar una aportación de 1€ al fondo del equipo."
5. **Respeto al entrenador, compañeros, rivales y árbitros** — *"El respeto es obligatorio dentro y fuera del campo."* — Violation: "Faltar al respeto al entrenador, compañeros, rivales o árbitros." — Consequence: "Se aplicará la medida educativa o deportiva que corresponda según la gravedad y reiteración. Cuando proceda, aportación de 1€." — Description: "El jugador debe respetar al entrenador, compañeros, rivales y árbitros dentro y fuera del campo. No se permitirán insultos, burlas, protestas reiteradas, agresiones ni cualquier falta de respeto." — Bullets: null — ConsequenceDetail: "Disculparse, apartarse de la actividad, banquillo, aportación de 1€ o desconvocatoria, según la gravedad o reincidencia."
6. **Imagen, higiene y hábitos del equipo** — *"La imagen y la higiene también forman parte del respeto al grupo."* — Violation: "Material incorrecto, no ducharse o no acudir al partido con la indumentaria necesaria." — Consequence: "Podrá limitar la participación en entrenamiento o partido. Las aportaciones económicas se aplicarán cuando así se indique." — Description: "El jugador debe cuidar su imagen, su material personal y los hábitos de higiene del equipo." — Bullets: null — ConsequenceDetail: null.
7. **Uso responsable del móvil** — *"Durante la actividad, la atención debe estar en el equipo."* — Violation: "Usar el móvil sin permiso durante entrenamientos, charlas o partidos." — Consequence: "Aportar 1€ al fondo del equipo." — Description: "Durante entrenamientos, charlas y partidos, el móvil debe estar guardado salvo permiso del entrenador." — Bullets: null — ConsequenceDetail: "Si un jugador usa el móvil sin permiso durante la actividad, deberá aportar 1€ al fondo del equipo."
8. **Cuidado del material y de las instalaciones** — *"El material y los espacios son responsabilidad de todos."* — Violation: "Perder material, dejar el vestuario sucio o romper material de forma intencionada." — Consequence: "Reparar, limpiar y si procede, aportar 1€ al fondo del equipo." — Description: "Balones, petos, conos, porterías, banquillos y vestuarios son responsabilidad de todos." — Bullets: ["Balón perdido sin responsable claro: si se pierde un balón durante el entrenamiento, todo el equipo dedicará 5 minutos al final de la sesión a buscarlo y recoger el material, y cada jugador deberá aportar 1€ al fondo del equipo si no se encuentra.", "Vestuario sucio o desordenado: si el vestuario queda sucio, desordenado o con basura al salir, todo el equipo lo dejará limpio y ordenado antes de marcharse, y cada jugador deberá aportar 1€ al fondo del equipo.", "Acción individual intencionada: si un jugador rompe material a propósito la consecuencia será individual: quedará fuera del siguiente ejercicio y partido de entrenamiento y deberá aportar 1€ al fondo del equipo. Si hay rotura o pérdida de material, la familia deberá hacerse cargo de la reposición o reparación cuando corresponda."] — ConsequenceDetail: null.
9. **Indumentaria completa en fotos del equipo** — *"La imagen del equipo en redes debe cuidarse entre todos."* — Violation: "Aparecer en fotos del equipo sin la ropa completa del club." — Consequence: "La foto no podrá subirse a redes y el jugador deberá aportar 1€ al fondo del equipo." — Description: "En las fotos oficiales o de equipo, los jugadores deberán llevar la ropa completa del club para mantener una imagen uniforme y cuidada." — Bullets: null — ConsequenceDetail: "Si un jugador aparece sin la ropa completa del club, la foto del equipo no podrá subirse a redes y deberá aportar 1€ al fondo del equipo."
10. **Comunicación y sinceridad con el entrenador** — *"Avisar a tiempo ayuda a cuidar al jugador y al equipo."* — Violation: "No comunicar molestias, lesiones, disponibilidad o situaciones importantes para el equipo." — Consequence: "Podrá afectar a la participación, convocatoria o medida educativa según las circunstancias. Cuando proceda, aportación de 1€." — Description: "El jugador debe comunicar al entrenador cualquier molestia, lesión, problema de disponibilidad o situación importante que pueda afectar al entrenamiento, al partido o al equipo." — Bullets: null — ConsequenceDetail: "No comunicarlo podrá afectar a la participación, convocatoria o medida educativa según las circunstancias. Cuando proceda, también podrá implicar una aportación de 1€ al fondo del equipo."
