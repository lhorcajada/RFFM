## Context

`SportEvent.Location` (`Domain/Aggregates/Assistances/SportEvent.cs:14`) is already the free-text location description shown across the app (`EventCard.tsx`, `AttendanceEvent.tsx`) and edited via a single `TextField` in `SportEventDialog.tsx`. The user confirmed scope is `SportEvents` (Coach calendar) only — not `Trainings/Sessions`. `CreateSportEvent`/`UpdateSportEvent` are minimal-API delegates (not Mediator/`ICommand`), matching the pattern already used by `coach-recurring-events` — this change keeps that shape rather than converting the endpoint to Mediator as a drive-by.

## Goals / Non-Goals

**Goals**
- Let the coach attach an optional Google Maps URL to an event, independent of the existing location text.
- Render that URL as a clickable "open in Maps" affordance everywhere the location is already shown.
- Validate the URL is well-formed before it is persisted.

**Non-Goals**
- Renaming or migrating the existing `Location` field — it keeps meaning "location description" exactly as today.
- Restricting the URL to Google Maps domains.
- Mobile app, or `Trainings/Sessions`.

## Decisions

### 1. Additive field, no rename: `SportEvent.LocationMapUrl`

Rejected renaming `Location` → `LocationDescription` even though the user's initial framing used that name, because:
- `Location` already holds exactly "location description" semantics today (see `SetLocation`'s doc/usage) — renaming touches every read site (`EventCard.tsx:395`, `AttendanceEvent.tsx:301`, `GetSportEvents.cs`, `GetSportEventItem.cs`, calendar sync in `SyncCalendarFromFederation.cs`) purely for a label change, with no behavior gained.
- A rename would need a data-preserving column rename in the migration; an additive nullable column needs none. Existing events automatically satisfy "description without a link" (acceptance criterion 3/5) since `LocationMapUrl` defaults to `NULL` — no backfill step required.

`SportEvent.cs`:
```csharp
public string? Location { get; set; } = null!;       // unchanged — location description
public string? LocationMapUrl { get; set; }            // NEW — optional Google Maps (or any) link

public void SetLocationMapUrl(string? locationMapUrl)
{
    if (string.IsNullOrEmpty(locationMapUrl)) { LocationMapUrl = null; return; }
    if (locationMapUrl.Length > ValidationAssistancesConstants.MaxLocationMapUrlLength)
        throw new ArgumentException($"El enlace de ubicación no puede tener más de {ValidationAssistancesConstants.MaxLocationMapUrlLength} caracteres");
    if (!Uri.TryCreate(locationMapUrl, UriKind.Absolute, out var uri) || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        throw new ArgumentException("El enlace de ubicación debe ser una URL http(s) válida");
    LocationMapUrl = locationMapUrl;
}
```

`ValidationAssistancesConstants.cs` gains `public const int MaxLocationMapUrlLength = 2048;` (matches common URL-length ceilings, same order of magnitude as `MaxDescriptionLength`).

`CreateNew(...)` gains a trailing optional parameter `string? locationMapUrl = null` (keeps existing call sites compiling) and sets it directly, mirroring how `Location` is already set without going through `SetLocation` in `CreateNew`.

### 2. API contract

`CreateSportEventRequest` / `UpdateSportEventRequest` (same files, vertical-slice convention) gain `string? LocationMapUrl`. `SportEventSaveResponse`, `GetSportEvents.SportEventListItemDto`, `GetSportEventItem`'s response DTO gain `string? LocationMapUrl` mirroring the existing `Location` property placement.

```csharp
public record CreateSportEventRequest(
    string Name, DateTime? EveDateTime, DateTime? StartTime, DateTime? EndTime,
    DateTime? ArrivalDate, string? Location, string? LocationMapUrl, string? Description,
    int EventTypeId, string TeamId, string? RivalId, bool? IsHomeMatch, string? CodActa,
    RecurrenceRequest? Recurrence = null, NewRivalRequest? NewRival = null
);
```

Validation (`CreateSportEventValidator`/`UpdateSportEventValidator`, FluentValidation — reusing the domain rule via a shared static, not duplicating regex logic):

```csharp
RuleFor(x => x.LocationMapUrl)
    .Must(BeAWellFormedHttpUrl)
    .WithMessage("El enlace de ubicación debe ser una URL http(s) válida")
    .When(x => !string.IsNullOrEmpty(x.LocationMapUrl));

private static bool BeAWellFormedHttpUrl(string? url) =>
    Uri.TryCreate(url, UriKind.Absolute, out var uri) &&
    (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
```

This mirrors the existing pattern of doing format validation in the FluentValidation layer (`§4.1` of `dotnet.md`) while the domain entity's `SetLocationMapUrl` re-asserts the same invariant for any other code path that constructs a `SportEvent` directly (defense in depth, same relationship `SetLocation`/its length check already has to the validator's `MaximumLength` rule — both exist, neither is redundant since the entity can be touched outside the HTTP layer too, e.g. `SyncCalendarFromFederation.cs`).

**Alternative considered**: validate only in FluentValidation, leave the entity setter unchecked. Rejected — `SetLocation` already re-checks length at the domain level even though the validator also does, so `SetLocationMapUrl` follows the same established (if slightly redundant) convention rather than being the first field to skip it.

Recurring-event instance generation in `CreateSportEvent.cs` (`ev.Location, ev.Description, ...` copied to each generated instance) is extended to also copy `ev.LocationMapUrl` — same treatment as `Location`, since a recurring series happens at the same place every time.

### 3. Persistence

New nullable column, `SportEventEntityConfiguration.cs`:
```csharp
builder.Property(se => se.LocationMapUrl)
    .IsRequired(false)
    .HasMaxLength(ValidationAssistancesConstants.MaxLocationMapUrlLength);
```
Migration via `.\manage-migrations.ps1` (Context `AppDbContext`) — single additive nullable `nvarchar` column, no backfill.

### 4. Frontend contract + form

`sportEventService.ts`: add `locationMapUrl?: string | null;` to `SportEventResponse` and `SportEventPayload`, right next to the existing `location` field.

`SportEventDialog.tsx`: add a `locationMapUrl` state, populated/reset alongside `location` in the existing `useEffect` blocks (lines 127/138), and a second `TextField` immediately after the "Ubicación" field:
```tsx
<TextField
  label="Enlace de Google Maps (opcional)"
  type="url"
  fullWidth
  size="small"
  value={locationMapUrl}
  onChange={(e) => setLocationMapUrl(e.target.value)}
  sx={{ mb: 2 }}
  placeholder="https://maps.google.com/..."
  error={!!locationMapUrlError}
  helperText={locationMapUrlError ?? undefined}
/>
```
Client-side validation added to `handleSave` (mirroring the existing early-return pattern used for name/eventType/recurrence): if `locationMapUrl` is non-empty and fails `new URL(locationMapUrl)` (wrapped in try/catch, since the constructor throws on invalid input rather than returning a boolean), set `setError("El enlace de ubicación debe ser una URL válida (debe empezar por http:// o https://).")` and return before calling the service — the backend re-validates regardless, but this avoids a round-trip for the common typo case, consistent with how `newRivalName` is checked client-side even though the backend validator also rejects an empty name.

### 5. Frontend display

`EventCard.tsx` (around line 394) and `AttendanceEvent.tsx` (around line 301) both currently render `event.location` as plain text. Both become:
```tsx
{event.location && (
  <div className={styles.location} title={event.location}>
    📍{" "}
    {event.locationMapUrl ? (
      <a
        href={event.locationMapUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        {event.location}
      </a>
    ) : (
      event.location
    )}
  </div>
)}
```
`onClick={(e) => e.stopPropagation()}` on `EventCard.tsx`'s link only — that card is itself clickable (opens the event), and per the "nearest sibling pattern" rule this must not trigger card-open navigation when the coach taps the map link. `AttendanceEvent.tsx`'s `infoRow` (line 299-302) is not itself clickable, so no `stopPropagation` needed there — keep it plain to avoid an unnecessary prop the reviewer would have to justify.

CSS: reuse the existing `styles.location` / `styles.value` class — the `<a>` tag needs no new CSS Module rule unless the current class does not already inherit a link-visible color (verify visually in both Federación... actually Coach-only, verify in Coach dark theme; add a minimal `a { color: inherit; text-decoration: underline; }` rule scoped to `.location a` only if the default anchor color clashes with the dark theme).

## Risks / Trade-offs

- **No domain allowlist for the URL**: a coach could paste an unrelated link (e.g. a WhatsApp group). Accepted per proposal's Out of Scope — the field is generically "a map link," not Google-Maps-verified, matching how `NewRivalRequest.UrlPhoto` is also an unchecked URL.
- **Client + server both validate URL format**: minor duplication, but consistent with how `Location`'s length check already exists in both the validator and `SetLocation` — not a new pattern.

## Migration Plan

Purely additive: one new nullable column, defaults to `NULL` for every existing row (renders as plain, non-clickable location text — current behavior, unchanged). No `Recurrence`/other contract fields shift position since C# records use named JSON properties, not positional binding, over the wire.

## Open Questions

None — scope, contract shape, and display behavior are all settled by the decisions above.
