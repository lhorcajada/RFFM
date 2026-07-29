# implement.md — align-mobile-theme-with-coach

Technical script for the `openspec-implementer` agent. Scope: `Mobile/` only. Do not touch `Front/` or `Back/`.

## Context

`Mobile/` (Expo React Native app, players/family members) currently hardcodes a generic iOS palette (`#007AFF`, `#fff`, `#666`, `#999`, `#ccc`/`#eee`, `#d32f2f`, `#4CAF50`) inline in each screen's `StyleSheet.create`. Goal: replace those literals with the real Coach web theme values (steel blue `#4d9de0` + teal `#4ec9b0` on navy `#07071a`/`#1c1c30`), extracted 1:1 from `Front/src/apps/coach/muiCoachTheme.ts` (read-only reference, do not edit). Full rationale and mapping table already in `design.md` (this same change folder) — follow it exactly, do not re-derive values.

No new libraries. Keep `StyleSheet.create` per screen. No shared npm package between `Front/` and `Mobile/` — values are duplicated by design (see `design.md` §1).

## Step 1 — RED: write the contract test first

Create `Mobile/src/theme/__tests__/colors.test.ts`. It MUST fail because `Mobile/src/theme/colors.ts` does not exist yet.

```ts
import { coachColors } from '../colors';

describe('coachColors', () => {
  it('matches the Coach web theme values (Front/src/apps/coach/muiCoachTheme.ts)', () => {
    expect(coachColors.background).toBe('#07071a');
    expect(coachColors.surface).toBe('#1c1c30');
    expect(coachColors.surfaceAlt).toBe('#252545');
    expect(coachColors.primary).toBe('#4d9de0');
    expect(coachColors.primaryLight).toBe('#7ab8f5');
    expect(coachColors.secondary).toBe('#4ec9b0');
    expect(coachColors.textPrimary).toBe('#e8e8e8');
    expect(coachColors.textSecondary).toBe('rgba(255,255,255,0.55)');
    expect(coachColors.border).toBe('rgba(255,255,255,0.08)');
    expect(coachColors.error).toBe('#ff9b9b');
    expect(coachColors.accentOrange).toBe('#ff9800');
    expect(coachColors.contrastText).toBe('#0d0d1f');
  });

  it('exposes exactly the 12 documented tokens (no drift)', () => {
    expect(Object.keys(coachColors).sort()).toEqual(
      [
        'background',
        'surface',
        'surfaceAlt',
        'primary',
        'primaryLight',
        'secondary',
        'textPrimary',
        'textSecondary',
        'border',
        'error',
        'accentOrange',
        'contrastText',
      ].sort(),
    );
  });
});
```

Run: `cd Mobile && npx jest src/theme/__tests__/colors.test.ts` — MUST fail (module not found).

## Step 2 — GREEN: create `Mobile/src/theme/colors.ts`

```ts
// Paleta extraída 1:1 de Front/src/apps/coach/muiCoachTheme.ts (tema Coach, web).
// Mantener sincronizado a mano si se retocan los valores del theme Coach.
export const coachColors = {
  background: '#07071a',      // palette.background.default
  surface: '#1c1c30',         // palette.background.paper / --rffm-card-bg
  surfaceAlt: '#252545',      // MuiAppBar backgroundColor
  primary: '#4d9de0',         // palette.primary.main
  primaryLight: '#7ab8f5',    // palette.primary.light
  secondary: '#4ec9b0',       // palette.secondary.main (teal)
  textPrimary: '#e8e8e8',     // palette.text.primary
  textSecondary: 'rgba(255,255,255,0.55)', // palette.text.secondary
  border: 'rgba(255,255,255,0.08)',        // palette.divider
  error: '#ff9b9b',           // AttendanceSummary.module.css
  accentOrange: '#ff9800',    // AttendanceTabs.module.css
  contrastText: '#0d0d1f',    // palette.primary.contrastText
} as const;

export type CoachColorToken = keyof typeof coachColors;
```

Run: `cd Mobile && npx jest src/theme/__tests__/colors.test.ts` — MUST pass now.

## Step 3 — migrate screens (literal → token mapping, from design.md §4)

For each file below: add `import { coachColors } from '../theme/colors';` and replace the listed literals in the `StyleSheet.create` block (and any inline `color={...}` props). Do not change JSX structure, testIDs, or logic — colors only.

Global mapping:
- `#007AFF` → `coachColors.primary`
- `#fff` (screen background) → `coachColors.background`
- `#666` → `coachColors.textSecondary`
- `#999` → `coachColors.textSecondary`
- `#ccc`, `#eee` → `coachColors.border`
- `#d32f2f` → `coachColors.error`

### `Mobile/src/screens/LoginScreen.tsx`
- `container.backgroundColor: '#fff'` → `coachColors.background`
- `subtitle.color: '#666'` → `coachColors.textSecondary`
- `input.borderColor: '#ccc'` → `coachColors.border`
- `button.backgroundColor: '#007AFF'` → `coachColors.primary`
- `buttonText.color: '#fff'` → `coachColors.contrastText`
- `errorText.color: '#d32f2f'` → `coachColors.error`
- Leave `title` (no explicit color today, inherits default) untouched unless it currently sets a literal — it does not.

### `Mobile/src/screens/TeamSwitcherScreen.tsx`
- `container.backgroundColor: '#fff'` → `coachColors.background`
- `teamCard.borderBottomColor: '#eee'` → `coachColors.border`
- `teamRole.color: '#666'` → `coachColors.textSecondary`
- `errorText.color: '#d32f2f'` → `coachColors.error`
- `<ActivityIndicator color="#007AFF">` → `color={coachColors.primary}`

### `Mobile/src/screens/CalendarScreen.tsx`
- `container.backgroundColor: '#fff'` → `coachColors.background`
- `eventCard.borderBottomColor: '#eee'` → `coachColors.border`
- `eventDate.color: '#666'` → `coachColors.textSecondary`
- `eventOpponent.color: '#007AFF'` → `coachColors.primary`
- `errorText.color: '#d32f2f'` → `coachColors.error`
- `retryButton.backgroundColor: '#007AFF'` → `coachColors.primary`
- `retryButtonText.color: '#fff'` → `coachColors.contrastText`
- `emptyText.color: '#999'` → `coachColors.textSecondary`
- `<ActivityIndicator color="#007AFF">` → `color={coachColors.primary}`

### `Mobile/src/screens/EventDetailScreen.tsx`
- `container.backgroundColor: '#fff'` → `coachColors.background`
- `status.color: '#666'` → `coachColors.textSecondary`
- `buttonPrimary.backgroundColor: '#4CAF50'` → `coachColors.secondary` (teal — Coach has no success green; teal is the nearest secondary, per design.md §4)
- `buttonSecondary.backgroundColor: '#f5f5f5'` → `coachColors.surface`
- `buttonSecondary.borderColor: '#ccc'` → `coachColors.border`
- `buttonText.color: '#fff'` → `coachColors.contrastText`
- `buttonTextSecondary.color: '#333'` → `coachColors.textPrimary`
- `errorText.color: '#d32f2f'` → `coachColors.error`
- `retryButton.backgroundColor: '#007AFF'` → `coachColors.primary`
- `retryButtonText.color: '#fff'` → `coachColors.contrastText`
- `emptyText.color: '#999'` → `coachColors.textSecondary`
- `<ActivityIndicator color="#007AFF">` → `color={coachColors.primary}`

### `Mobile/src/screens/NewsScreen.tsx`
- `container.backgroundColor: '#fff'` → `coachColors.background`
- `placeholder.color: '#999'` → `coachColors.textSecondary`
- No existing `title` color literal; leave as-is unless it needs `coachColors.textPrimary` for contrast against the new dark background — since the container is now dark, ADD `title: { ... color: coachColors.textPrimary }` (title currently has no color set, defaulting to black-on-white; on a navy background it would be invisible, so this addition is required for the screen to remain usable, not a design overreach).

Note: check `LoginScreen.tsx`'s `title` similarly — it also has no explicit color today (default black text). Since the container background flips to navy, ADD `title: { ... color: coachColors.textPrimary }` in `LoginScreen.tsx` styles for the same reason (otherwise title text becomes invisible on dark background). This is a minimal, necessary consequence of the palette flip described in design.md §4 ("esto invierte fondo blanco→navy oscuro"), not scope creep — flag it in the final report as a small addition beyond the literal mapping table.

Do NOT add a color for `teamNameText` in `TeamSwitcherScreen.tsx` or `eventTitle` in `CalendarScreen.tsx` or `playerName` in `EventDetailScreen.tsx` unless they currently have no color AND would be invisible against the new dark background — check each: if a `Text` has no explicit `color` in its style and sits on the (now dark) screen background, add `color: coachColors.textPrimary` to keep it legible. Apply this rule consistently to any label found invisible after the flip, and list every such addition in the final summary.

## Step 4 — `Mobile/src/navigation/RootNavigator.tsx`

Add a custom navigation theme built from `DarkTheme`:

```tsx
import { DarkTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { coachColors } from '../theme/colors';

const rffmCoachNavTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: coachColors.background,
    card: coachColors.surfaceAlt,
    text: coachColors.textPrimary,
    primary: coachColors.primary,
    border: coachColors.border,
  },
};
```

Pass it: `<NavigationContainer theme={rffmCoachNavTheme}>`. Do not add explicit `headerStyle` overrides — React Navigation inherits `card`/`text`/`primary` for headers and tab bar automatically (per design.md §5).

## Step 5 — verify

Run in order, fix any failure before proceeding:
1. `cd Mobile && npx jest src/theme/__tests__/colors.test.ts` — contract test green.
2. `cd Mobile && npx jest` — full suite, 100% pass, 0 skipped. Existing screen tests must still pass unchanged (they assert behavior/testIDs, not colors, per the audit done before writing this script).
3. `cd Mobile && npx tsc --noEmit` — no type errors, no new `any`.
4. `git diff --stat` — confirm only files under `Mobile/src/` changed (`theme/colors.ts`, `theme/__tests__/colors.test.ts`, the 5 screens, `navigation/RootNavigator.tsx`). Nothing under `Front/` or `Back/`.
5. Grep for leftover literals: `grep -rnE "#007AFF|#d32f2f|#4CAF50|#f5f5f5" Mobile/src/screens Mobile/src/navigation` should return nothing (a few generic grays like `#ccc`/`#eee`/`#666`/`#999`/`#fff`/`#333` should also be gone per the mapping above — grep for those too and confirm zero hits outside `Mobile/src/theme/colors.ts` itself).

## Step 6 — tasks.md

Mark all checkboxes in `openspec/changes/align-mobile-theme-with-coach/tasks.md` as done (`[x]`) for the items actually completed. If the manual Expo visual check (section 5/6) cannot be run in this environment, leave that specific manual-verification checkbox unchecked and say so explicitly in the final report — do not check off something not actually performed.

## Final report requirements

List every file created/modified (absolute paths), full test results (pass count), and explicitly call out:
- The two additions beyond the literal mapping table (`LoginScreen.tsx` and `NewsScreen.tsx` title color, if applicable) and why.
- Any hex literal deliberately left untouched, with justification.
- Whether the manual Expo/simulator visual check was performed or skipped.
