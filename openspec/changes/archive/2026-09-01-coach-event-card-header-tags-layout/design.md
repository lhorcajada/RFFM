## Context

`EventCard.tsx` + `EventCard.module.css` render a fixed-height "trading card" (`.card`, 320px desktop / 230px at `max-width:480px`) used non-compact in `AttendanceTabs.tsx` ("Eventos" list) and compact (`height:auto`) in `UpcomingEventsWidget.tsx` (dashboard).

Two bugs were already fixed earlier in this session, and their fixes must be preserved:
1. The Local/Visitante badge in `.matchHeader` moved from `position:absolute` into normal flow (`.matchTeamsRow` holding both team blocks + score/vs center), because it used to overlap wrapped long team names.
2. `.title`, `.location`, `.rival`, `.eventName`, `.metaRow` got `flex-shrink:0` so that, when body content exceeds the fixed height, flexbox clips the *last* row cleanly instead of squashing a middle row to 0-height and overlapping its text.

Both lessons point the same direction: **prefer flow layout + flex-shrink:0 over absolute positioning**, and accept that a fixed-height card needs its height increased when content grows, rather than parenting more content into the same box.

## Goals / Non-Goals

**Goals:**
- Arrival chip visible for any event type when the data exists.
- One shared "event type" tag, lateralized (left edge) in the header, implemented once — same JSX/logic path for compact and non-compact, no `compact`-specific conditional beyond existing CSS size overrides.
- All chips (Convocatoria, attendance badges, Local/Visitante, marcador, Partido, event-type tag, Llegada) visible without clipping/overlap at desktop and ≤480px.
- Root-cause fix: give the card enough height for its real content, not a one-off patch.

**Non-Goals:**
- Changing the compact (dashboard) card, which already uses `height:auto` and is not reported as broken.
- Redesigning the visual style (chrome/pitch look) beyond spacing/sizing needed to fit content.
- Touching `EventAttendanceBadges` component logic (only its container's `flex-shrink` in its own CSS module, since it renders inside `.body`).

## Decisions

1. **Event-type tag: flow-based, left-aligned, in a shared top bar used by *both* headers.**
   (Revised after user review of the in-progress diff: the type tag must also appear on match cards, not only the generic header, and the header should shrink rather than grow.) Both `.header` and `.matchHeader` now start with a `.headerTopBar` row (`display:flex; justify-content:space-between`) holding `.headerTopBarLeft` (the `eventTypeName` chip, `.headerTypeTag`) and, for the match header only, `.headerTopBarRight` (the existing Home/Away badge, moved out of its own dedicated row into this shared one). This means the match header gains the type tag **without** growing — the badge row it already had is reused as the shared top bar instead of adding a second row. The generic header's `.headerAvatarWrap` (`flex:1`, centered) fills the rest of the header below the top bar. Same JSX/CSS path for compact and non-compact; only sizing differs via `.compact`/media-query overrides.
   *Alternative considered (original decision, superseded)*: type tag only in the generic header, reasoning the "Partido" body chip already indicates match type. Rejected on review — the user wants the same lateralized indicator in both header variants, and reusing the existing badge row means it costs no extra height.

2. **Header heights reduced, not just re-padded.**
   Since the top bar replaces a vertically-centered stack (avatar+chip, or badge-then-teams) with a compact flow row + a tightly-fit content area below it, the fixed header heights no longer need the slack they had. Reduced (all `flex-shrink:0`, all still comfortably fit their content per decision 1's layout): desktop generic `.header` 132px → 96px; desktop `.matchHeader` 132px → 112px (shields/team-name/score need more room than the avatar); `.compact` headers 88px → 74px; `@media (max-width:480px)` non-compact headers 78px → 66px; compact-at-mobile 62px → 54px. This directly frees more of the fixed `.card` height for `.body` (chips, attendance badges) instead of only growing `.card` itself, addressing the "cards overlap on every device" feedback by giving `.body` a materially larger budget on top of the `.card` height increase in decision 5 below.

3. **Arrival chip moves out of `isTraining`.**
   `arrivalTimeStr` is already derived event-type-agnostically (`event.arrivalDate ?? event.arrival`); only the render condition was scoped to training. Removing that scoping is a one-line JSX change with no CSS impact — the chip already sits in a wrapping flex row.

4. **Merge the three body chip rows (Partido / Llegada / Convocatoria) into one `.chipsRow`.**
   Previously "Partido" had its own inline-styled `<div>`, and Llegada+Convocatoria had a second inline-styled `<div>`, both only for their respective isMatch/isTraining branches — meaning a training event could show 2 chips and a match could show at most 1 (Partido only, since arrival was excluded). Now a match can show Partido+Llegada, and a training can show Llegada+Convocatoria — always mutually exclusive on the isMatch/isTraining axis, so at most 2 chips in this row, laid out via one `.chipsRow` CSS class (`display:flex;flex-wrap:wrap;gap:6px;flex-shrink:0;margin-top:4px`) replacing the two ad-hoc inline `style={{...}}` divs — consistent with `.metaRow`'s existing pattern and the repo's "no inline styles" rule for anything reusable.

5. **`EventAttendanceBadges`'s containers get `flex-shrink:0`.**
   Root-cause read of "en móvil solo se ve un tag": `.coachContainer`/`.playerContainer` (in `EventAttendanceBadges.module.css`) had no `flex-shrink:0`, unlike every other row already patched in `EventCard.module.css` in the prior session. Under a fixed-height, `overflow:hidden` `.body`, an un-pinned flex child can still be compressed under the available-space calculation for earlier siblings, and whatever doesn't fit is clipped by `.body`'s `overflow:hidden` — consistent with the "only one tag visible" report, since the 5-chip attendance row is the last (largest) row and had no shrink protection.

6. **Increase `.card`'s fixed height (both breakpoints), measured against a real browser render — not estimated.**
   An initial pass raised the heights based on manual estimation of MUI Chip/typography metrics (desktop 320→372px, mobile 230→280px). That estimate was wrong: a real-browser measurement (via a temporary preview route + `claude-in-chrome`, see tasks.md §3.4) of `body.scrollHeight` vs. the rendered `.body` box showed the worst-case card (training: title+metaRow+location+eventName+chipsRow+5-badge attendance row, which wraps to 2 lines) still overflowed by **70px at the mobile breakpoint** and **8px at desktop** — invisible clipped content, exactly matching the user's "solo se ve un tag" report. Final, measured-correct values:
   - Desktop `.card` height: 320px → **384px** (0px overflow, confirmed for match/training/tournament).
   - `@media (max-width:480px)` `.card` height: 230px → **360px** (0px overflow, confirmed for match/training/tournament at a genuine 400px CSS-pixel viewport).
   `.compact` is untouched (`height:auto` already sizes to content — confirmed 0px overflow at both breakpoints without any change).
   *Alternative considered*: drop the 5-badge attendance row to smaller chips/abbreviated labels instead of growing the card. Rejected as out of scope — user asked to fix layout, not redesign/shrink the attendance-badge content, and `EventAttendanceBadges` is shared with other cards (`MatchCard.tsx`) so changing its visual size has a wider blast radius than growing one card's height.
   *Lesson*: manual CSS-metric estimation is not a substitute for measuring `scrollHeight` vs. rendered height in an actual browser — the two disagreed by up to 70px in this case, which is exactly the size of the bug being fixed.

## Risks / Trade-offs

- [Taller cards shift the "Eventos" grid's visual density] → Acceptable: cards remain a fixed, predictable size (still a "trading card" grid), just taller; no layout tests assert exact pixel height.
- [Height numbers derived from manual estimation of MUI Chip/typography metrics disagreed with the real browser by up to 70px] → Resolved, not just mitigated: replaced the estimate with actual `scrollHeight`/`getBoundingClientRect()` measurements taken in a real Chromium render (see decision 6 and tasks.md §3.4); final values (384px desktop / 360px mobile) confirmed at 0px overflow for every card variant.
- [Existing test `EventCard.trainingBadges.test.tsx` asserts arrival is hidden for match/tournament events] → This assertion is being intentionally inverted per the new requirement; the test file is updated as part of this change (Red→Green), not left broken.

## Open Questions

None — scope and acceptance criteria were confirmed by the user before this design was written.
