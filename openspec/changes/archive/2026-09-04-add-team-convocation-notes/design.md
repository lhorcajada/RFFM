## Context

Today `Front/src/apps/coach/pages/convocations/components/ConvocationDetailsDialog.tsx` and
`Front/src/apps/coach/pages/convocations/utils/convocationSummary.ts` (`buildWhatsAppText`)
hardcode two warning lines about kits/espinilleras. The user wants these to become a
per-team, coach-editable list of free-text notes persisted in the database, with the two
existing hardcoded strings surviving as default content so nothing is lost for teams that
already rely on that warning.

The closest sibling in the codebase for "small per-team sub-resource with role-gated writes
and an open-ish read" is `Features/Coaches/Kits/{GetTeamKits,SaveClubKits}.cs` (Mediator
`IFeatureModule` slices, `AppDbContext` directly, `RequireAuthorization` with
`AuthorizeAttribute.Roles`). The closest sibling for "read access mirrors an existing read's
authorization criterion" is `Features/Coaches/Convocations/GetEventConvocations.cs`, which
gates via `IRequireFeaturePermission` (`FeatureRoute = CoachFeatureRoutes.Convocations`,
`RequiredPermission = "Read"`) plus `IRequireTeamMembership` (only enforced for `Player`/
`FamilyMember` roles, per `TeamMembershipBehavior`). Reusing that exact `FeatureRoute` means
whatever roles are seeded with `Read`/`ReadWrite` access to `/coach/convocations` today
(Administrator bypasses entirely, others follow `FeaturePermissions` table rows) get the same
access to team notes automatically — no need to hardcode or duplicate the role list.

The closest sibling for "individually addressable CRUD items owned by a team, ordered by
creation" is `TeamRule`/`TeamRulesSet` — but that aggregate replaces its whole rule list on
every save (`ReplaceRules`), which does not fit here: notes are created/edited/deleted
independently, one at a time, not as a full-list replace. So `TeamNote` is designed as an
independent, directly-queryable entity (not an owned/embedded collection like `TeamRule`),
mirroring `ClubKit`'s shape (`BaseEntity`, factory `Create`, one mutation method) more closely
than `TeamRule`'s.

## Goals / Non-Goals

**Goals:**
- Full CRUD (`GET` list / `POST` / `PUT` / `DELETE`) for a team's convocation notes.
- Lazy default-seed: a team with zero notes gets the two existing hardcoded warnings
  persisted the first time its notes are listed — no bulk data migration over all existing
  teams.
- Read access exactly mirrors `GetEventConvocations`'s authorization criterion.
- Writes (create/edit/delete) restricted to the `Coach` role only, per explicit user
  requirement — deliberately narrower than `Administrator,Coach` patterns used elsewhere in
  the repo (e.g. `SetPlayerSanction`), because the user asked for `Coach`-only, not
  `Coach`-or-`Administrator`.
- Stable, documented contract for `front-specialist` to consume afterward.

**Non-Goals:**
- Any frontend work (dialog/WhatsApp text changes) — out of scope for this change.
- Reordering notes after creation — creation order is fixed and never rearranged (per
  acceptance criteria: "se muestran en el orden en que se crearon (sin reordenar)").
- A title/heading per note — notes are plain single-paragraph free text.
- Migrating/backfilling all existing teams' notes eagerly — the lazy seed-on-first-read
  covers this without a data migration.

## Decisions

### 1. New entity `TeamNote`, not an owned collection
`Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/TeamNote.cs`:

```csharp
public class TeamNote : BaseEntity
{
    public string TeamId { get; private set; } = null!;
    public string Text { get; private set; } = null!;
    public int Order { get; private set; }

    public Team Team { get; private set; } = null!;

    private TeamNote() { }

    public static TeamNote Create(string teamId, string text, int order)
    {
        if (string.IsNullOrWhiteSpace(teamId))
            throw new ArgumentException("TeamId cannot be empty.", nameof(teamId));
        if (string.IsNullOrWhiteSpace(text))
            throw new ArgumentException("Text cannot be empty.", nameof(text));

        return new TeamNote { TeamId = teamId, Text = text.Trim(), Order = order };
    }

    public void UpdateText(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            throw new ArgumentException("Text cannot be empty.", nameof(text));
        Text = text.Trim();
    }
}
```

`Order` is an explicit `int`, assigned at creation time as `(current max Order for the team)
+ 1` (starting at 1) — not derived from `CreatedAt`, mirroring `TeamRule.Order`'s pattern of
an explicit ordering column rather than relying on timestamp precision/ties. Unlike
`TeamRule`, `Order` is assigned once at creation and never renumbered on delete (deleting note
#2 of 3 leaves orders `{1, 3}` — still a valid total order, no gap-closing needed since the
UI only needs relative order, not contiguous integers).

Alternative considered: reuse `TeamRule`'s `ReplaceRules`-style whole-list rebuild. Rejected
because the acceptance criteria describe independent create/edit/delete of single notes, not
a save-the-whole-list-at-once flow — forcing the frontend to resend the entire list on every
edit would be a worse fit for a simple "add a note" / "fix a typo" interaction.

### 2. Route shape and verbs
Mirrors `SaveClubKits`'s resource nesting under `teams/{teamId}`:
- `GET /api/teams/{teamId}/notes` → `TeamNoteResponse[]`
- `POST /api/teams/{teamId}/notes` → `201 Created`, `TeamNoteResponse`, `Location` header
  `/api/teams/{teamId}/notes/{noteId}`
- `PUT /api/teams/{teamId}/notes/{noteId}` → `200 OK`, `TeamNoteResponse`
- `DELETE /api/teams/{teamId}/notes/{noteId}` → `204 No Content`

```json
// TeamNoteResponse
{ "id": "…", "teamId": "…", "text": "…", "order": 1 }
```

### 3. Four files, one per Mediator slice — mirrors `Features/Coaches/Kits/`
`Features/Coaches/Notes/GetTeamNotes.cs`, `CreateTeamNote.cs`, `UpdateTeamNote.cs`,
`DeleteTeamNote.cs`. Each is a self-contained `IFeatureModule` (route + request +
command/query + handler + validator, per vertical-slice convention) using `IRequestHandler`
over `AppDbContext` directly — same style as `GetTeamKits`/`SaveClubKits`, not the raw Minimal
API lambda style of `SetPlayerSanction` (that one explicitly opts out of Mediator/
FluentValidation for a simpler sub-resource; here the task explicitly asked for the
`IFeatureModule` + Mediator pattern).

### 4. Authorization split: read via `IRequireFeaturePermission`, writes via `[Authorize(Roles = "Coach")]`
- `GetTeamNotesQuery : IQueryApp<TeamNoteResponse[]>, IRequireFeaturePermission, IRequireTeamMembership`
  with `FeatureRoute => CoachFeatureRoutes.Convocations` and `RequiredPermission => "Read"` —
  byte-for-byte the same gate `EventConvocationsQuery` uses, so "same roles that can already
  view a convocation" holds by construction rather than by hand-copying a role list that could
  drift.
- `CreateTeamNoteCommand`/`UpdateTeamNoteCommand`/`DeleteTeamNoteCommand` use
  `.RequireAuthorization(new AuthorizeAttribute { Roles = "Coach" })` on the route (same
  ASP.NET Core mechanism as `SaveClubKits`/`DeleteSportEvent`, narrowed to a single role per
  the explicit acceptance criterion "solo rol Coach"). This is deliberately *not*
  `IRequireFeaturePermission` — feature permissions are role-driven from a DB table intended
  for read/write *feature* access tiers (Administrator bypasses them entirely), which would
  let Administrator write notes too; the user's criterion is Coach-only, full stop.

### 5. Lazy seed lives in `GetTeamNotesQuery`'s handler, not a data migration
```csharp
var team = await db.Teams.AsNoTracking().FirstOrDefaultAsync(t => t.Id == request.TeamId, ct);
if (team == null) throw new NotFoundException("Equipo no encontrado", "TeamNotFound");

var notes = await db.TeamNotes.Where(n => n.TeamId == request.TeamId).OrderBy(n => n.Order).ToListAsync(ct);
if (notes.Count == 0)
{
    notes =
    [
        TeamNote.Create(request.TeamId, DefaultNoteText1, 1),
        TeamNote.Create(request.TeamId, DefaultNoteText2, 2),
    ];
    db.TeamNotes.AddRange(notes);
    await db.SaveChangesAsync(ct);
}
return notes.Select(ToResponse).ToArray();
```
The default strings are `const` fields on `GetTeamNotes`, copied verbatim from
`convocationSummary.ts`'s two hardcoded lines. Chosen over a data migration/seeder that
touches every existing team row because (a) it's a smaller, safer change (no bulk UPDATE
across all clubs' teams), (b) it naturally covers teams created after this change ships too,
and (c) mirrors the "resolve on first read" spirit already used for `GetTeamRules` (returns
`null`/204 until a rules set is explicitly created — the difference here is we auto-create
instead of returning empty, per the explicit seed requirement).

Race condition note: if two concurrent first-reads both see zero notes, both would insert a
duplicate seed pair. Accepted as a known, low-probability edge case (same class of risk
`SaveClubKits`'s design.md already accepted for its unique index) — not mitigated with a
unique constraint because notes have no natural uniqueness key (free text). Out of scope to
add optimistic concurrency here since no other slice in this codebase does either.

### 6. Validation (FluentValidation)
`Text`: `NotEmpty()`, `MaximumLength(500)`. 500 chosen (vs. the 280–500 range suggested) to
comfortably fit the two existing seed strings plus headroom for a coach writing a couple of
sentences, while still fitting on one WhatsApp-message line without needing pagination in the
future frontend list UI.

### 7. Migration
New table `TeamNotes` (schema `app`, via `AppDbContext`), analogous to `ClubKitEntityConfiguration`:
`Id` (string PK), `TeamId` (string, FK to `Teams`, indexed), `Text` (`nvarchar`/`text`,
`HasMaxLength(500)`), `Order` (int). Generated via
`.\manage-migrations.ps1 -Action create -MigrationName AddTeamNotes -Context AppDbContext`.

### 8. Errors
- Unknown `teamId` → `404` via `RFFM.Api.Domain.NotFoundException` (same type as
  `SaveClubKits`/`SaveTeamRules`).
- Unknown `noteId` for a given `teamId` (create implied N/A; update/delete) → `404` via the
  same `NotFoundException` type, with a distinct code (`TeamNoteNotFound`) — team existing but
  note not found under it is still a 404, not a 400, consistent with `SetPlayerSanction`'s
  `sanctionId` handling.
- Validation failures (empty/too-long text) → `400` via `ValidationBehavior`/FluentValidation,
  standard pipeline.
- Role not `Coach` on writes → `403 Forbidden` via ASP.NET Core `RequireAuthorization`.
- Role/team-membership not allowed on read → `403 Forbidden` via `FeaturePermissionBehavior`/
  `TeamMembershipBehavior` (same as `GetEventConvocations`).

## Risks / Trade-offs

- [Concurrent first-reads double-seed] → Accepted, documented in Decision 5; no unique
  constraint added since notes have no natural key.
- [`Coach`-only writes excludes `Administrator`] → Deliberate, per explicit acceptance
  criterion; documented in Decision 4 so it's not "fixed" accidentally later to match other
  features' `Administrator,Coach` pattern.
- [`Order` never renumbered after delete] → Accepted; UI only needs relative ordering, gaps
  are harmless.

## Open Questions

None — all decisions the task left open (entity shape/location, seed mechanism, exact roles
for read vs. write, max text length) are resolved above.
