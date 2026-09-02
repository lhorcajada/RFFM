# Design: Live Match Tracking Enhancements

## 1. Data model changes (backend)

### 1.1 `MatchParticipation` entity
`Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/MatchParticipation.cs`

Add one new column, following the existing "opaque JSON blob, duplicated across every
player row for the event" pattern already used for `GoalsJson`/`CardsJson`/`SubstitutionWindowsJson`:

```csharp
/// <summary>Serialised JSON array of FormationChangeEvent objects applied during the match.</summary>
public string? FormationChangesJson { get; private set; }
```

- `Create(...)` and `Update(...)` gain a `string? formationChangesJson = null` parameter, assigned like `CardsJson`.
- No change to `CardsJson`'s column — it already exists (migration `20260728165531_AddCardsJsonToMatchParticipation`); only its *documented shape* grows (see §3).

Migration: `AddFormationChangesJsonToMatchParticipation` (single nullable `text` column, additive — no data migration needed).

### 1.2 `SaveMatchParticipation.cs`
- `SaveMatchParticipationRequest`: add `public string? FormationChangesJson { get; init; }`.
- `Handler.Handle`: pass `request.FormationChangesJson` through to both `MatchParticipation.Create(...)` and `record.Update(...)` calls (mirrors how `CardsJson` is already threaded).

### 1.3 `GetMatchParticipation.cs`
Two additive fixes to `MatchParticipationResponse`:
- Add `CardsJson` — **currently missing from the response despite being persisted** (confirmed gap: `GoalsJson` is returned, `CardsJson` is not). Coach app cannot currently redisplay saved cards.
- Add `FormationChangesJson`.

```csharp
public record MatchParticipationResponse(
    string EventId,
    string TeamId,
    int ScoreLocal,
    int ScoreVisitor,
    string MatchPhase,
    string? SubstitutionWindowsJson,
    string? RatingSnapshotsJson,
    string? GoalsJson,
    string? CardsJson,
    string? FormationChangesJson,
    List<PlayerParticipationRecord> Players);
```
`Handler.Handle` maps `first.CardsJson` / `first.FormationChangesJson` the same way `first.GoalsJson` is mapped today.

### 1.4 `GetPlayerSeasonCards.cs` — no functional change required
`CountCards(cardsJson, teamPlayerId, cardType)` (lines 273-300) reads only `teamPlayerId` and
`cardType` by property name via `JsonDocument` — additive new properties (`minute`, `half`,
`isRivalPlayer`, `rivalDorsal`) on each card entry are ignored safely. Update only the XML doc
comment above `CardsJson` (entity) and `CountCards` to document the richer shape (see §3) so
future readers aren't misled by the old two-field description.

### 1.5 No backend enforcement of substitution-window limits
Confirmed: the 4-total/3-second-half cap is a pure frontend rule (`useLiveMatch.ts`); the
backend has no validation on `SubstitutionWindowsJson` contents. No backend change needed for
the "unlimited windows on friendlies" requirement — it is entirely a frontend concern (§5).

---

## 2. Backend verification
```bash
cd Back/ExtractionApi
dotnet ef migrations add AddFormationChangesJsonToMatchParticipation --startup-project src/RFFM.Host
dotnet build
dotnet test --filter FullyQualifiedName~MatchParticipation
```

---

## 3. New JSON shapes (documented, not enforced server-side)

### GoalEvent (extends existing shape)
```ts
interface GoalEvent {
  id: string;
  minute: number;
  scorerId: string | null;
  scorerName: string | null;
  scorerDorsal: number | null;
  isOwnTeam: boolean;
  scoreAtMoment: { local: number; visitor: number };
  /** NEW — pitch cell the goal was scored from; null if not recorded (legacy goals) */
  pitchZone: { col: number; row: number } | null; // col: 0-4 (width), row: 0-9 (length, both halves)
  /** NEW — null if not recorded (legacy goals) */
  bodyPart: "head" | "foot" | null;
}
```

### CardEvent (new — nothing writes this today)
```ts
interface CardEvent {
  id: string;
  minute: number;
  half: 1 | 2;
  cardType: "yellow" | "red";
  /** Own-team player, or null for a rival card */
  teamPlayerId: string | null;
  playerName: string | null;
  /** True when the card was shown to a rival player */
  isRivalPlayer: boolean;
  /** Free-text shirt number, only meaningful when isRivalPlayer is true */
  rivalDorsal: number | null;
}
```

### FormationChangeEvent (new)
```ts
interface FormationChangeEvent {
  id: string;
  minute: number;
  half: 1 | 2;
  formationId: string;
  formationName: string; // e.g. "4-4-2" — snapshot, so history survives formation renames
  /** Full slot map immediately after the change */
  slotsAfter: Record<number, string | null>;
}
```
A player's position at any match minute is derived (not stored per-player) by taking the
most recent `FormationChangeEvent`/`SubstitutionWindow` at-or-before that minute and mapping
the player's slot index through `FORMATION_POSITIONS[formationName][slotIndex].label`. This
avoids a redundant per-player-per-minute table and reuses the same "chronological snapshot"
pattern already used for substitution windows.

---

## 4. Frontend types
`Front/src/apps/coach/pages/convocations/components/simulation/liveMatch.types.ts`

- Extend `GoalEvent` with `pitchZone` and `bodyPart` (both nullable, so old localStorage
  backups / already-saved matches deserialize fine).
- Add `CardEvent` and `FormationChangeEvent` interfaces (§3).
- Extend `LiveMatchBackup` with `cards: CardEvent[]` and `formationChanges: FormationChangeEvent[]`.
- Extend `LiveMatchParticipationPayload` with `cardsJson: string` and `formationChangesJson: string`.

---

## 5. `useLiveMatch.ts` changes

### 5.1 Unlimited substitution windows on friendlies
Mirror the existing `useMatchSimulation.ts` options pattern (`enableWindowLimits`,
`maxTotalWindows`, `maxSecondHalfWindows`) instead of inventing a new shape:

```ts
export interface UseLiveMatchOptions {
  /** When true (friendly matches), the substitution-window quota is not enforced */
  unlimitedWindows?: boolean;
}

export function useLiveMatch(
  eventId: string | null,
  teamId: string,
  isHomeTeam = true,
  options: UseLiveMatchOptions = {},
): UseLiveMatchReturn {
  const { unlimitedWindows = false } = options;
  ...
  const canOpenWindow =
    !prepareMode &&
    (matchPhase === "firstHalf" || matchPhase === "secondHalf" || matchPhase === "halftime") &&
    (isHalftime || unlimitedWindows ||
      (windowsTotal < MAX_TOTAL_WINDOWS &&
        (half === 1 || windowsInSecondHalf < MAX_SECOND_HALF_WINDOWS)));
```
Return `unlimitedWindows` in `UseLiveMatchReturn` so `SubstitutionWindowTracker` can show
"Infinitos" (it already supports this via its existing `unlimitedWindows` prop — currently
unwired, see §7).

### 5.2 Cards
New state `cards: CardEvent[]` + ref, mirroring `goals`/`goalsRef`:
```ts
const addCard = useCallback((
  teamPlayerId: string | null,
  playerName: string | null,
  isRivalPlayer: boolean,
  rivalDorsal: number | null,
  cardType: "yellow" | "red",
) => {
  const card: CardEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    minute: currentMinuteRef.current,
    half: halfRef.current,
    cardType,
    teamPlayerId,
    playerName,
    isRivalPlayer,
    rivalDorsal,
  };
  setCards((prev) => [...prev, card]);
}, []);

const removeCard = useCallback((cardId: string) => {
  setCards((prev) => prev.filter((c) => c.id !== cardId));
}, []);
```
Included in `initMatch` (reset to `[]`), `writeBackup`/`restoreFromBackup` (persist/restore),
and `persistMatchParticipation` (`cardsJson: JSON.stringify(cardsRef.current)`).

### 5.3 Goal zone + body part
`addGoal` signature grows two nullable params (kept nullable so `LiveMatchScoreboard`'s
existing own-goal path — which has no zone/body-part UI — keeps compiling with `null`):
```ts
addGoal: (
  scorerId: string | null,
  scorerName: string | null,
  scorerDorsal: number | null,
  isOwnTeam: boolean,
  pitchZone: { col: number; row: number } | null,
  bodyPart: "head" | "foot" | null,
) => void;
```

### 5.4 Mid-match formation changes
New state `formationChanges: FormationChangeEvent[]` + a `changeFormation` action:
```ts
const changeFormation = useCallback((
  formationId: string,
  formationName: string,
  newSlots: Record<number, string | null>,
) => {
  const change: FormationChangeEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    minute: currentMinuteRef.current,
    half: halfRef.current,
    formationId,
    formationName,
    slotsAfter: { ...newSlots },
  };
  setFormationChanges((prev) => [...prev, change]);
  setSlots({ ...newSlots });
  // Re-anchor playerStates exactly like commitWindow does for entering/leaving players,
  // using the same slot map (players not present in newSlots move to bench).
}, []);
```
The confirmation step itself lives in the component layer (§6), matching the existing
pattern where `useLiveMatch` exposes a raw action and `PartidoEnDirectoTab` gates it behind a
`Dialog` (see how `commitWindow` vs. the "Cambio confirmado" dialog are already split).
`changeFormation` is only callable when `matchPhase` is `firstHalf`/`halftime`/`secondHalf`
(guarded in the UI, not the hook, consistent with `commitWindow`).

Player-state remapping reuses the leaving/entering diff logic already written in
`commitWindow` (lines 700-758 of `useLiveMatch.ts`) — extract it into a shared
`applySlotChange(newSlots, minute)` helper used by both `commitWindow` and `changeFormation`
to avoid duplicating the accumulated-minutes bookkeeping.

---

## 6. New / modified frontend components

### 6.1 `PitchZoneGrid.tsx` (new)
`Front/src/apps/coach/pages/convocations/components/simulation/PitchZoneGrid.tsx`
- Renders a 5 (columns) × 10 (rows) grid representing the full pitch (both halves), CSS
  Modules only, no cell labels (per requirement).
- Props: `{ value: { col: number; row: number } | null; onChange: (cell: { col: number; row: number }) => void }`.
- Pure presentational; reused inside the goal dialog (§6.2) — no external CSS beyond its own
  `PitchZoneGrid.module.css`.

### 6.2 `LiveMatchScoreboard.tsx` — goal dialog rework
- Remove the immediate `onAddGoal(null, null, null, false)` shortcut for rival goals
  (currently `openGoalDialog`, lines 57-65) — rival goals now open the same `Dialog` used for
  own-team goals, with a different body:
  - Own-team goal: existing scorer list (unchanged) + **new** `PitchZoneGrid` + head/foot
    `ToggleButtonGroup`.
  - Rival goal: **new** free-text dorsal `TextField` (numeric) + `PitchZoneGrid` + head/foot
    toggle (own goals for the visitor team keep the existing "Gol en propia puerta" path,
    unaffected).
- `onAddGoal` prop signature updated to match §5.3.

### 6.3 `GoalTimeline.tsx`
- Render the zone (e.g. a small grid-position badge "col,row" or a mini pitch icon — final
  visual left to implementation, must not require new i18n strings) and a head/foot icon
  next to the existing scorer line, only when both are non-null (legacy goals show nothing
  extra).

### 6.4 `CardEventDialog.tsx` (new) + `CardsTimeline.tsx` (new)
- `CardEventDialog.tsx`: mirrors `LiveMatchScoreboard`'s goal dialog — pick own player from
  `fieldPlayers`/full squad, or "Rival" with a numeric dorsal field; pick amarilla/roja.
  Minute/half are read from the hook (`live.currentMinute`, `live.half`) at submit time, not
  user-editable (consistent with how goals capture minute automatically).
- `CardsTimeline.tsx`: same layout as `GoalTimeline.tsx` — minute, card-type icon (🟨/🟥),
  player name or "Rival (#dorsal)", remove button (hidden when `readOnly`).
- A new "Tarjeta" button is added next to the existing "Gol"/"Gol rival" buttons in
  `LiveMatchScoreboard.tsx`, opening `CardEventDialog`.

### 6.5 Mid-match formation change control
- `PartidoEnDirectoTab.tsx`: the existing `formationId`/`formations` state (currently only
  used to seed the initial lineup, lines 235-236) becomes live-editable. Add a compact
  `<Select>` (visible whenever `live.matchPhase !== "preMatch" && live.matchPhase !== "finished"`)
  listing `formations`, plus a confirmation `Dialog` ("¿Cambiar a esquema {name}? Se guardará
  el historial de posiciones.") that, on accept, computes a best-effort `newSlots` map (players
  currently on field kept in the same relative slots where possible, using the new formation's
  `FormationSlotDef[]`; anyone who no longer fits goes to the bench) and calls
  `live.changeFormation(formationId, formationName, newSlots)`.
- A read-only `FormationHistoryPanel.tsx` (optional, mirrors `SubstitutionHistoryPanel.tsx`)
  lists `live.formationChanges` for post-match review.

### 6.6 `SubstitutionWindowTracker.tsx`
- Wire the already-existing `unlimitedWindows` prop (today only affects the `showCounters=false`
  compact label) into the default dot-counter branch too: when `unlimitedWindows` is true,
  render the raw `windowsTotal` count without a `/MAX_TOTAL_WINDOWS` denominator or dot cap.

---

## 7. Threading "is this a friendly" into the live tracker

`ConvocationMatchDetail.tsx` (parent of `PartidoEnDirectoTab`) has no `SportEventType`/friendly
flag on its `MatchState` today (confirmed — `convocationMatchDetail.types.ts:2-16`). The
backend already computes this per-event as `SportEventResponse.matchCategory: "Friendly" | ...`
(`sportEventService.ts:3,17`), fetchable via `getSportEventById(eventId)`.

- `ConvocationMatchDetail.tsx`: fetch `getSportEventById(convocation.mgmtEventId)` alongside
  its other event data, derive `const isFriendly = event?.matchCategory === "Friendly"`, and
  pass a new `isFriendly` prop down to `PartidoEnDirectoTab`.
- `PartidoEnDirectoTab.tsx`: pass `{ unlimitedWindows: isFriendly }` into
  `useLiveMatch(eventId, teamId, isHomeTeam, { unlimitedWindows: isFriendly })`.

This reuses the backend's already-stable `matchCategory` field instead of re-deriving
"amistoso" from event-type name strings client-side (the fragile regex approach used in
`useDesconvocatoriasGrid.ts`'s local `isFriendlyEvent`, which is not reused here).

---

## 8. Frontend verification
```bash
cd Front
npm run build
npm run test
```

## 9. Out of scope reminders (do not implement)
- Extra time / penalties as a match "part" for cards.
- A `RivalPlayer` roster entity — rival dorsal stays a free-text number on the card/goal event.
- Backend-side enforcement of the substitution-window quota (frontend-only rule today and
  after this change).
