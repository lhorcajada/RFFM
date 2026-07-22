# Implementation Script — responsive-game-model-editor

Audience: `openspec-implementer` subagent. Follow this script top to bottom, task by task. Each task
maps to a group in `tasks.md` (same numbering). For every task marked TDD: create/edit the test file
first, run `npm run test -- <pattern>` from `Front/` and confirm it FAILS (Red) for the right reason
(missing component/behavior, not a typo), THEN write the implementation, then re-run and confirm PASS
(Green). Check off both this file's checkboxes and the matching `tasks.md` checkboxes as you go
(only when genuinely done and verified).

Working directory for all `npm` commands: `Front/`. Use `npm run test -- <substring>` to run a subset
(vitest matches by filename/describe substring).

Do not touch: `Front/src/apps/coach/pages/game-model/components/GameModelPrintView.tsx`,
`Front/src/apps/coach/context/GameModelDraftContext.tsx`, anything under `Back/`.

Conventions to respect everywhere (per `.github/instructions/copilot-instructions.md` and
`design.md`):
- CSS Modules co-located, no inline `sx` for anything reusable, no new colors — reuse the exact
  hex/rgba values already used in the files you touch (e.g. `#4d9de0`, `#a8d4f5`, `#e8e8e8`,
  `#1c1c30`, `#07071a`, `rgba(77, 157, 224, …)`).
- TypeScript strict — no `any`. Generic components must be properly typed.
- No barrel `index.ts` re-exports.
- MUI breakpoint used everywhere: `@media (max-width: 899.95px)` in CSS, `theme.breakpoints.down("md")`
  in TS (900px is MUI's default `md`).
- Mock `useMediaQuery` in tests exactly like this existing pattern (copy verbatim into new test files):
  ```ts
  const mockUseMediaQuery = vi.fn();
  vi.mock("@mui/material/useMediaQuery", () => ({
    default: (...args: unknown[]) => mockUseMediaQuery(...args),
  }));
  ```
  (see `Front/src/apps/coach/pages/settings/components/ClubSelector/__tests__/ClubSelector.test.tsx`
  lines 25-28 for the reference — no `ThemeProvider` wrapper needed since the hook itself is mocked).

---

## 1. Shared `DrillDownPanel` shell (TDD)

### 1.1 — Write the test (Red)

Create `Front/src/apps/coach/pages/game-model/components/__tests__/DrillDownPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ComponentProps } from "react";

const mockUseMediaQuery = vi.fn();
vi.mock("@mui/material/useMediaQuery", () => ({
  default: (...args: unknown[]) => mockUseMediaQuery(...args),
}));

import DrillDownPanel from "../DrillDownPanel";

interface Item {
  id: number;
  label: string;
}

const items: Item[] = [
  { id: 1, label: "Uno" },
  { id: 2, label: "Dos" },
];

function renderPanel(overrides: Partial<ComponentProps<typeof DrillDownPanel<Item>>> = {}) {
  const onSelect = vi.fn();
  const onBack = vi.fn();
  render(
    <DrillDownPanel<Item>
      items={items}
      getKey={(item) => item.id}
      selectedIndex={null}
      onSelect={onSelect}
      onBack={onBack}
      renderListItem={(item) => <span>{item.label}</span>}
      renderDetail={(item) => <div>Detalle de {item.label}</div>}
      listAriaLabel="Lista de items"
      emptyMessage="Sin elementos"
      {...overrides}
    />
  );
  return { onSelect, onBack };
}

describe("DrillDownPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("en móvil sin selección muestra la lista y no el detalle", () => {
    mockUseMediaQuery.mockReturnValue(true);
    renderPanel({ selectedIndex: null });
    expect(screen.getByText("Uno")).toBeInTheDocument();
    expect(screen.queryByText(/Detalle de/)).not.toBeInTheDocument();
  });

  it("en móvil con selección muestra el detalle, oculta la lista y expone el botón Volver", () => {
    mockUseMediaQuery.mockReturnValue(true);
    renderPanel({ selectedIndex: 0 });
    expect(screen.getByText("Detalle de Uno")).toBeInTheDocument();
    expect(screen.queryByText("Dos")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver" })).toBeInTheDocument();
  });

  it("el botón Volver invoca onBack", async () => {
    mockUseMediaQuery.mockReturnValue(true);
    const { onBack } = renderPanel({ selectedIndex: 0 });
    await userEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("en escritorio muestra lista y detalle simultáneamente", () => {
    mockUseMediaQuery.mockReturnValue(false);
    renderPanel({ selectedIndex: 0 });
    expect(screen.getByText("Uno")).toBeInTheDocument();
    expect(screen.getByText("Dos")).toBeInTheDocument();
    expect(screen.getByText("Detalle de Uno")).toBeInTheDocument();
  });

  it("el elemento seleccionado expone aria-current", () => {
    mockUseMediaQuery.mockReturnValue(false);
    renderPanel({ selectedIndex: 1 });
    const selected = screen.getByText("Dos").closest('[role="button"]');
    expect(selected).toHaveAttribute("aria-current", "true");
  });

  it("selecciona un item al hacer click", async () => {
    mockUseMediaQuery.mockReturnValue(false);
    const { onSelect } = renderPanel({ selectedIndex: null });
    await userEvent.click(screen.getByText("Uno"));
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it("sin selección en escritorio muestra el emptyMessage", () => {
    mockUseMediaQuery.mockReturnValue(false);
    renderPanel({ selectedIndex: null });
    expect(screen.getByText("Sin elementos")).toBeInTheDocument();
  });
});
```

Run `npm run test -- DrillDownPanel` from `Front/` — it MUST fail because `../DrillDownPanel` doesn't
exist yet.

- [x] 1.1 Test written and confirmed failing.

### 1.2 — Implement `DrillDownPanel.tsx` (Green)

Create `Front/src/apps/coach/pages/game-model/components/DrillDownPanel.tsx`:

```tsx
import type { ReactNode } from "react";
import { Box, Typography, IconButton } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import styles from "./DrillDownPanel.module.css";

export interface DrillDownPanelProps<T> {
  items: T[];
  getKey: (item: T, index: number) => string | number;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onBack: () => void;
  renderListItem: (item: T, index: number, isSelected: boolean) => ReactNode;
  renderDetail: (item: T, index: number) => ReactNode;
  renderListFooter?: ReactNode;
  detailTitle?: (item: T, index: number) => ReactNode;
  listAriaLabel: string;
  emptyMessage: string;
}

/**
 * Presentational drill-down / master-detail navigation shell.
 * Below `md` (900px): single pane, list OR detail, with a back control.
 * At/above `md`: list and detail side by side.
 * Knows nothing about game-model data — purely navigation/layout.
 */
export default function DrillDownPanel<T>({
  items,
  getKey,
  selectedIndex,
  onSelect,
  onBack,
  renderListItem,
  renderDetail,
  renderListFooter,
  detailTitle,
  listAriaLabel,
  emptyMessage,
}: DrillDownPanelProps<T>) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const selectedItem = selectedIndex !== null ? items[selectedIndex] : undefined;

  const list = (
    <Box component="ul" aria-label={listAriaLabel} className={styles.list}>
      {items.map((item, index) => (
        <li key={getKey(item, index)} className={styles.listItemWrap}>
          <div
            role="button"
            tabIndex={0}
            aria-current={index === selectedIndex ? "true" : undefined}
            className={`${styles.listItem}${index === selectedIndex ? ` ${styles.listItemSelected}` : ""}`}
            onClick={() => onSelect(index)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(index);
              }
            }}
          >
            {renderListItem(item, index, index === selectedIndex)}
          </div>
        </li>
      ))}
      {renderListFooter && <li className={styles.listFooter}>{renderListFooter}</li>}
    </Box>
  );

  const detail =
    selectedItem !== undefined ? (
      <Box className={styles.detail}>
        {isMobile && (
          <Box className={styles.detailHeader}>
            <IconButton size="small" aria-label="Volver" className={styles.backBtn} onClick={onBack}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            {detailTitle && (
              <Typography component="h3" className={styles.detailTitle}>
                {detailTitle(selectedItem, selectedIndex as number)}
              </Typography>
            )}
          </Box>
        )}
        {renderDetail(selectedItem, selectedIndex as number)}
      </Box>
    ) : (
      <Box className={styles.emptyDetail}>
        <Typography className={styles.emptyMessage}>{emptyMessage}</Typography>
      </Box>
    );

  if (isMobile) {
    return <Box className={styles.mobileRoot}>{selectedIndex === null ? list : detail}</Box>;
  }

  return (
    <Box className={styles.masterDetailRoot}>
      <Box className={styles.listColumn}>{list}</Box>
      <Box className={styles.detailColumn}>{detail}</Box>
    </Box>
  );
}
```

Create `Front/src/apps/coach/pages/game-model/components/DrillDownPanel.module.css`:

```css
.mobileRoot {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.masterDetailRoot {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  min-width: 0;
}

.listColumn {
  flex: 0 0 300px;
  max-width: 320px;
  min-width: 0;
  max-height: 70vh;
  overflow-y: auto;
}

.detailColumn {
  flex: 1;
  min-width: 0;
  max-height: 70vh;
  overflow-y: auto;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.listItemWrap {
  min-width: 0;
}

.listItem {
  display: block;
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  text-align: left;
  background-color: #1c1c30;
  border: 1px solid rgba(77, 157, 224, 0.25);
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  color: inherit;
  font: inherit;
}

.listItem:hover {
  background-color: rgba(60, 60, 60, 0.5);
}

.listItemSelected {
  border-color: #4d9de0;
  background-color: rgba(77, 157, 224, 0.15);
}

.listFooter {
  list-style: none;
  margin-top: 4px;
}

.detail {
  min-width: 0;
}

.detailHeader {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.backBtn {
  color: #4d9de0 !important;
  min-width: 44px !important;
  min-height: 44px !important;
}

.detailTitle {
  font-size: 1.3rem !important;
  font-weight: 700 !important;
  color: #e8e8e8 !important;
  margin: 0 !important;
}

.emptyDetail {
  padding: 20px;
  text-align: center;
}

.emptyMessage {
  color: rgba(212, 212, 212, 0.5) !important;
  font-style: italic;
  font-size: 1.28rem !important;
}

@media (max-width: 899.95px) {
  .listItem {
    padding: 10px 14px;
  }
}
```

Run `npm run test -- DrillDownPanel` — must pass now.

- [x] 1.2 `DrillDownPanel.tsx` + `.module.css` implemented, test passes (Green).

---

## 2. Editor: SubSubPrinciple detail form + skills touch-target fix (TDD)

This and the next two groups rewrite `ScenarioFormAccordion.tsx` internals. Build it bottom-up: this
group only prepares the `SkillRow` CSS fix (the component itself is finished in Task 3 alongside
`SubPrincipleDetailForm`, since `SubSubPrincipleDetailForm` is a small piece composed there — writing
it in isolation first, as its own exported-for-test function, avoids a giant single-commit rewrite).

### 2.1 — Fix `SkillRow` touch targets (no test framework needed for pure CSS; verified visually in Task 8, but add a regression test now)

Create `Front/src/apps/coach/pages/game-model/components/__tests__/ScenarioFormAccordion.skillrow.test.tsx`
(Red — this file imports the *current* `ScenarioFormAccordion.tsx` which still exports the old
`{ mi, zi, si, scenario, defaultExpanded }` shape; this test will be superseded/replaced by Task 4's
fuller test, so keep it minimal and delete it once Task 4's test file supersedes it):

Actually — do **not** create a separate skillrow test file. Instead fold this into Task 3's test
(`SubPrincipleDetailForm` renders `SubSubPrincipleDetailForm` which renders `SkillRow`s). Skip 2.1 as a
standalone step and proceed directly to Task 3, which covers this. Mark 2.1 done once Task 3's test
(section 3.1) includes a skill-row assertion, per that section's instructions below.

- [x] 2.1 Deferred into Task 3 (see note above) — no separate action here.

### 2.2 — CSS fix (apply now, independent of the component rewrite)

In `Front/src/apps/coach/pages/game-model/components/ScenarioFormAccordion.module.css`, replace the
existing `.skillRow`, `.skillNameField`, `.skillDescField` rules' fixed-width behavior by APPENDING
(do not delete the existing rules — they still apply at `md+`) this block at the end of the file:

```css
/* ── Responsive: skill row stacks + touch targets below md (900px) ── */
@media (max-width: 899.95px) {
  .skillRow {
    flex-direction: column;
    align-items: stretch;
  }

  .skillNameField {
    flex: 1 1 auto;
  }

  .skillNameField .MuiOutlinedInput-root,
  .skillDescField .MuiOutlinedInput-root {
    min-height: 44px;
  }

  .deleteIconBtn {
    min-width: 44px !important;
    min-height: 44px !important;
    align-self: flex-end;
  }
}
```

- [x] 2.2 CSS block appended to `ScenarioFormAccordion.module.css`.

---

## 3. Editor: rewrite `ScenarioFormAccordion.tsx` (Scenario → SubPrinciple → SubSubPrinciple via `DrillDownPanel`, TDD)

### Important API change (deviation from a literal per-scenario prop, decided during implementation —
note it in your final report): `ScenarioFormAccordion`'s props change from
`{ mi, zi, si, scenario, defaultExpanded }` (one instance per scenario) to `{ mi, zi, scenarios }` (one
instance per zone, rendering the whole scenario list through `DrillDownPanel`). This is required
because the proposal/spec mandate drill-down/master-detail AT the Scenario level too, not just below
it — one `ScenarioFormAccordion` per scenario could not do that. `GameModelCreate.tsx`'s
`ZoneFormContent` is updated accordingly in Task 4. There is no `MOVE_SCENARIO` reducer action (checked
`GameModelDraftContext.tsx` — scenarios were never drag-reorderable), so the top scenario list has
**no** drag handle / move buttons, only a delete button per item — this matches existing behavior.

### 3.1 — Write the test (Red)

Create `Front/src/apps/coach/pages/game-model/components/__tests__/ScenarioFormAccordion.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { GameModel, Scenario } from "../../../../types/gameModel";
import { GameModelDraftProvider } from "../../../../context/GameModelDraftContext";
import ScenarioFormAccordion from "../ScenarioFormAccordion";

const mockUseMediaQuery = vi.fn();
vi.mock("@mui/material/useMediaQuery", () => ({
  default: (...args: unknown[]) => mockUseMediaQuery(...args),
}));

function buildScenario(id: number, order: number, subPrincipleCount = 0): Scenario {
  return {
    id,
    order,
    name: `Escenario ${order}`,
    context: "",
    tacticalPrinciples: [],
    subPrinciples: Array.from({ length: subPrincipleCount }, (_, i) => ({
      id: id * 100 + i,
      order: i + 1,
      label: String.fromCharCode(65 + i),
      name: `Subprincipio ${String.fromCharCode(65 + i)}`,
      context: "",
      tacticalPrinciples: [],
      subSubPrinciples: [],
    })),
  };
}

function buildDraft(scenarios: Scenario[]): GameModel {
  return {
    id: "draft-1",
    teamId: "team-1",
    name: "Modelo de prueba",
    season: "2025/2026",
    gameMoments: [
      { id: 1, name: "Momento", zones: [{ id: 1, name: "Zona", scenarios }] },
    ],
  };
}

function renderWithDraft(scenarios: Scenario[]) {
  const draft = buildDraft(scenarios);
  render(
    <GameModelDraftProvider initialDraft={draft} availablePrinciples={[]}>
      <ScenarioFormAccordion mi={0} zi={0} scenarios={draft.gameMoments[0].zones[0].scenarios} />
    </GameModelDraftProvider>
  );
}

describe("ScenarioFormAccordion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMediaQuery.mockReturnValue(false); // desktop by default
  });

  it("muestra la lista de escenarios y su detalle en escritorio", () => {
    renderWithDraft([buildScenario(1, 1), buildScenario(2, 2)]);
    expect(screen.getByText("Escenario 1")).toBeInTheDocument();
    expect(screen.getByText("Escenario 2")).toBeInTheDocument();
  });

  it("selecciona automáticamente el único escenario cuando solo hay uno", () => {
    renderWithDraft([buildScenario(1, 1)]);
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
  });

  it("añadir escenario despacha ADD_SCENARIO y aparece un nuevo escenario en la lista", async () => {
    renderWithDraft([buildScenario(1, 1)]);
    await userEvent.click(screen.getByRole("button", { name: /añadir escenario/i }));
    expect(screen.getByText("Escenario 2")).toBeInTheDocument();
  });

  it("dentro del detalle de un escenario, añadir subprincipio despacha ADD_SP", async () => {
    renderWithDraft([buildScenario(1, 1, 0)]);
    await userEvent.click(screen.getByRole("button", { name: /añadir subprincipio/i }));
    expect(screen.getByText("Subprincipio A")).toBeInTheDocument();
  });

  it("los botones mover arriba/abajo de subprincipio están deshabilitados en los extremos", () => {
    renderWithDraft([buildScenario(1, 1, 2)]);
    const rows = screen.getAllByRole("button", { name: "Mover arriba" });
    expect(rows[0]).toBeDisabled();
    const downButtons = screen.getAllByRole("button", { name: "Mover abajo" });
    expect(downButtons[downButtons.length - 1]).toBeDisabled();
  });

  it("mover un subprincipio abajo despacha MOVE_SP y reordena", async () => {
    renderWithDraft([buildScenario(1, 1, 2)]);
    const downButtons = screen.getAllByRole("button", { name: "Mover abajo" });
    await userEvent.click(downButtons[0]); // move first subprinciple down
    // After moving, label "A" now maps to what was "B" (reducer relabels A/B by index)
    const list = screen.getByLabelText("Lista de subprincipios");
    const items = within(list).getAllByRole("button");
    expect(items[0]).toHaveTextContent("Subprincipio B");
  });

  it("añadir sub-subprincipio dentro de un subprincipio despacha ADD_SSP y muestra sus campos", async () => {
    renderWithDraft([buildScenario(1, 1, 1)]);
    await userEvent.click(screen.getByRole("button", { name: /añadir sub-subprincipio/i }));
    expect(screen.getByPlaceholderText(/Acción: describe/)).toBeInTheDocument();
  });

  it("las filas de habilidad se apilan verticalmente por CSS (clase presente) al añadir una habilidad", async () => {
    renderWithDraft([buildScenario(1, 1, 1)]);
    await userEvent.click(screen.getByRole("button", { name: /añadir sub-subprincipio/i }));
    await userEvent.click(screen.getByRole("button", { name: /añadir habilidad/i }));
    expect(screen.getByPlaceholderText("Nombre de la habilidad")).toBeInTheDocument();
  });
});
```

Run `npm run test -- ScenarioFormAccordion` — must fail (current component doesn't accept `scenarios`
prop, doesn't render this structure).

- [x] 3.1 Test written and confirmed failing.

### 3.2 — Rewrite `ScenarioFormAccordion.tsx` (Green)

Replace the entire content of
`Front/src/apps/coach/pages/game-model/components/ScenarioFormAccordion.tsx` with:

```tsx
import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Autocomplete,
  IconButton,
  Chip,
  Button,
  Tooltip,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import type { Scenario, SubPrinciple, SubSubPrinciple, TacticalPrinciple } from "../../../types/gameModel";
import { useGameModelDraft } from "../../../context/GameModelDraftContext";
import DrillDownPanel from "./DrillDownPanel";
import styles from "./ScenarioFormAccordion.module.css";

// ─── Skill row ───────────────────────────────────────────────────────

interface SkillRowProps {
  mi: number; zi: number; si: number; pi: number; qi: number; ki: number;
  name: string;
  description: string;
}

function SkillRow({ mi, zi, si, pi, qi, ki, name, description }: SkillRowProps) {
  const { dispatch } = useGameModelDraft();
  return (
    <Box className={styles.skillRow}>
      <TextField
        value={name}
        onChange={(e) =>
          dispatch({ type: "UPD_SKILL", mi, zi, si, pi, qi, ki, changes: { name: e.target.value } })
        }
        placeholder="Nombre de la habilidad"
        size="small"
        className={styles.skillNameField}
        variant="outlined"
      />
      <TextField
        value={description}
        onChange={(e) =>
          dispatch({ type: "UPD_SKILL", mi, zi, si, pi, qi, ki, changes: { description: e.target.value } })
        }
        placeholder="Descripción de la habilidad"
        size="small"
        className={styles.skillDescField}
        variant="outlined"
        multiline
        maxRows={3}
      />
      <Tooltip title="Eliminar habilidad">
        <IconButton
          size="small"
          className={styles.deleteIconBtn}
          onClick={() => dispatch({ type: "DEL_SKILL", mi, zi, si, pi, qi, ki })}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

// ─── SubSubPrinciple detail form ─────────────────────────────────────

interface SubSubPrincipleDetailFormProps {
  mi: number; zi: number; si: number; pi: number; qi: number;
  ssp: SubSubPrinciple;
}

function SubSubPrincipleDetailForm({ mi, zi, si, pi, qi, ssp }: SubSubPrincipleDetailFormProps) {
  const { dispatch } = useGameModelDraft();
  return (
    <Box className={styles.sspDetailForm}>
      <TextField
        value={ssp.name}
        onChange={(e) => dispatch({ type: "UPD_SSP", mi, zi, si, pi, qi, changes: { name: e.target.value } })}
        placeholder="Nombre del sub-subprincipio…"
        size="small"
        label="Nombre"
        fullWidth
        className={styles.detailNameField}
      />
      <TextField
        value={ssp.action}
        onChange={(e) => dispatch({ type: "UPD_SSP", mi, zi, si, pi, qi, changes: { action: e.target.value } })}
        placeholder="Acción: describe lo que hace el jugador en este momento…"
        multiline
        minRows={2}
        fullWidth
        size="small"
        className={styles.contextField}
        label="Acción"
      />
      <Box className={styles.skillsSection}>
        <Typography className={styles.sectionLabel}>Habilidades imprescindibles</Typography>
        {ssp.essentialSkills.map((sk, ki) => (
          <SkillRow key={sk.id} mi={mi} zi={zi} si={si} pi={pi} qi={qi} ki={ki} name={sk.name} description={sk.description} />
        ))}
        <Button
          size="small"
          startIcon={<AddIcon />}
          className={styles.addBtn}
          onClick={() => dispatch({ type: "ADD_SKILL", mi, zi, si, pi, qi })}
        >
          Añadir habilidad
        </Button>
      </Box>
    </Box>
  );
}

// ─── SubPrinciple detail form (hosts SubSubPrinciple DrillDownPanel) ─

interface SubPrincipleDetailFormProps {
  mi: number; zi: number; si: number; pi: number;
  sp: SubPrinciple;
}

function SubPrincipleDetailForm({ mi, zi, si, pi, sp }: SubPrincipleDetailFormProps) {
  const { dispatch, availablePrinciples } = useGameModelDraft();
  const [selectedQi, setSelectedQi] = useState<number | null>(sp.subSubPrinciples.length === 1 ? 0 : null);
  const [draggingSspIdx, setDraggingSspIdx] = useState<number | null>(null);
  const [dragOverSspIdx, setDragOverSspIdx] = useState<number | null>(null);

  useEffect(() => {
    if (selectedQi !== null && selectedQi >= sp.subSubPrinciples.length) setSelectedQi(null);
  }, [sp.subSubPrinciples.length, selectedQi]);

  return (
    <Box className={styles.spDetailForm}>
      <TextField
        value={sp.name}
        onChange={(e) => dispatch({ type: "UPD_SP", mi, zi, si, pi, changes: { name: e.target.value } })}
        placeholder="Nombre del subprincipio…"
        size="small"
        label="Nombre"
        fullWidth
        className={styles.detailNameField}
      />
      <TextField
        value={sp.context}
        onChange={(e) => dispatch({ type: "UPD_SP", mi, zi, si, pi, changes: { context: e.target.value } })}
        placeholder="Contexto del subprincipio: describe la situación de juego…"
        multiline
        minRows={2}
        fullWidth
        size="small"
        className={styles.contextField}
        label="Contexto"
      />
      <Autocomplete
        multiple
        options={availablePrinciples}
        getOptionLabel={(o: TacticalPrinciple) => o.name}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        value={sp.tacticalPrinciples}
        onChange={(_, value) => dispatch({ type: "UPD_SP", mi, zi, si, pi, changes: { tacticalPrinciples: value } })}
        renderInput={(params) => (
          <TextField {...params} label="Principios tácticos colectivos" size="small" className={styles.principlesField} />
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => {
            const { key, ...tagProps } = getTagProps({ index });
            return <Chip key={key} label={option.name} size="small" {...tagProps} className={styles.principleChip} />;
          })
        }
        className={styles.principlesAutocomplete}
      />

      <Box className={styles.nestedSection}>
        <Typography className={styles.sectionLabel}>Sub-subprincipios</Typography>
        <DrillDownPanel<SubSubPrinciple>
          items={sp.subSubPrinciples}
          getKey={(ssp) => ssp.id}
          selectedIndex={selectedQi}
          onSelect={setSelectedQi}
          onBack={() => setSelectedQi(null)}
          listAriaLabel="Lista de sub-subprincipios"
          emptyMessage="No hay sub-subprincipios. Añade el primero."
          detailTitle={(_ssp, qi) => `Sub-subprincipio ${qi + 1}`}
          renderListFooter={
            <Button
              size="small"
              startIcon={<AddIcon />}
              className={styles.addBtn}
              onClick={() => dispatch({ type: "ADD_SSP", mi, zi, si, pi })}
            >
              Añadir sub-subprincipio
            </Button>
          }
          renderListItem={(ssp, qi) => (
            <Box
              className={`${styles.dragRow}${draggingSspIdx === qi ? ` ${styles.isDragging}` : ""}${dragOverSspIdx === qi && draggingSspIdx !== qi ? ` ${styles.isDragOver}` : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverSspIdx(qi); }}
              onDragLeave={() => setDragOverSspIdx(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingSspIdx !== null && draggingSspIdx !== qi) {
                  dispatch({ type: "MOVE_SSP", mi, zi, si, pi, from: draggingSspIdx, to: qi });
                }
                setDraggingSspIdx(null);
                setDragOverSspIdx(null);
              }}
            >
              <Box
                component="span"
                className={styles.dragHandle}
                draggable
                onClick={(e) => e.stopPropagation()}
                onDragStart={(e: React.DragEvent) => {
                  e.stopPropagation();
                  e.dataTransfer.setData("text/plain", String(qi));
                  e.dataTransfer.effectAllowed = "move";
                  setDraggingSspIdx(qi);
                }}
                onDragEnd={() => { setDraggingSspIdx(null); setDragOverSspIdx(null); }}
              >
                <DragIndicatorIcon />
              </Box>
              <Box className={styles.reorderBtns}>
                <IconButton
                  size="small"
                  aria-label="Mover arriba"
                  className={styles.reorderBtn}
                  disabled={qi === 0}
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: "MOVE_SSP", mi, zi, si, pi, from: qi, to: qi - 1 }); }}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="Mover abajo"
                  className={styles.reorderBtn}
                  disabled={qi === sp.subSubPrinciples.length - 1}
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: "MOVE_SSP", mi, zi, si, pi, from: qi, to: qi + 1 }); }}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </Box>
              <Box className={styles.dragRowContent}>
                <Typography className={styles.sspNumber}>Sub-subprincipio {qi + 1}</Typography>
                <Typography className={styles.listItemName}>{ssp.name || "Sin nombre"}</Typography>
                {ssp.essentialSkills.length > 0 && (
                  <Chip label={`${ssp.essentialSkills.length} hab.`} size="small" className={styles.countChip} />
                )}
                <Tooltip title="Eliminar sub-subprincipio">
                  <IconButton
                    size="small"
                    className={styles.deleteIconBtn}
                    onClick={(e) => { e.stopPropagation(); dispatch({ type: "DEL_SSP", mi, zi, si, pi, qi }); }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          )}
          renderDetail={(ssp, qi) => (
            <SubSubPrincipleDetailForm mi={mi} zi={zi} si={si} pi={pi} qi={qi} ssp={ssp} />
          )}
        />
      </Box>
    </Box>
  );
}

// ─── Scenario detail form (hosts SubPrinciple DrillDownPanel) ───────

interface ScenarioDetailFormProps {
  mi: number; zi: number; si: number;
  scenario: Scenario;
}

function ScenarioDetailForm({ mi, zi, si, scenario }: ScenarioDetailFormProps) {
  const { dispatch, availablePrinciples } = useGameModelDraft();
  const [selectedPi, setSelectedPi] = useState<number | null>(scenario.subPrinciples.length === 1 ? 0 : null);
  const [draggingSpIdx, setDraggingSpIdx] = useState<number | null>(null);
  const [dragOverSpIdx, setDragOverSpIdx] = useState<number | null>(null);

  useEffect(() => {
    if (selectedPi !== null && selectedPi >= scenario.subPrinciples.length) setSelectedPi(null);
  }, [scenario.subPrinciples.length, selectedPi]);

  return (
    <Box className={styles.scenarioDetailForm}>
      <TextField
        value={scenario.name}
        onChange={(e) => dispatch({ type: "UPD_SCENARIO", mi, zi, si, changes: { name: e.target.value } })}
        placeholder="Nombre del escenario…"
        size="small"
        label="Nombre"
        fullWidth
        className={styles.detailNameField}
      />
      <TextField
        value={scenario.context}
        onChange={(e) => dispatch({ type: "UPD_SCENARIO", mi, zi, si, changes: { context: e.target.value } })}
        placeholder="Contexto: describe la situación del juego en este escenario…"
        multiline
        minRows={2}
        fullWidth
        size="small"
        className={styles.contextField}
        label="Contexto"
      />
      <Autocomplete
        multiple
        options={availablePrinciples}
        getOptionLabel={(o: TacticalPrinciple) => o.name}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        value={scenario.tacticalPrinciples}
        onChange={(_, value) => dispatch({ type: "UPD_SCENARIO", mi, zi, si, changes: { tacticalPrinciples: value } })}
        renderInput={(params) => (
          <TextField {...params} label="Principios tácticos colectivos" size="small" className={styles.principlesField} />
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => {
            const { key, ...tagProps } = getTagProps({ index });
            return <Chip key={key} label={option.name} size="small" {...tagProps} className={styles.principleChip} />;
          })
        }
        className={styles.principlesAutocomplete}
      />

      <Box className={styles.nestedSection}>
        <Typography className={styles.sectionLabel}>Subprincipios</Typography>
        <DrillDownPanel<SubPrinciple>
          items={scenario.subPrinciples}
          getKey={(sp) => sp.id}
          selectedIndex={selectedPi}
          onSelect={setSelectedPi}
          onBack={() => setSelectedPi(null)}
          listAriaLabel="Lista de subprincipios"
          emptyMessage="No hay subprincipios. Añade el primero."
          detailTitle={(sp) => `Subprincipio ${sp.label}`}
          renderListFooter={
            <Button
              size="small"
              startIcon={<AddIcon />}
              className={styles.addBtn}
              onClick={() => dispatch({ type: "ADD_SP", mi, zi, si })}
            >
              Añadir subprincipio
            </Button>
          }
          renderListItem={(sp, pi) => (
            <Box
              className={`${styles.dragRow}${draggingSpIdx === pi ? ` ${styles.isDragging}` : ""}${dragOverSpIdx === pi && draggingSpIdx !== pi ? ` ${styles.isDragOver}` : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverSpIdx(pi); }}
              onDragLeave={() => setDragOverSpIdx(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingSpIdx !== null && draggingSpIdx !== pi) {
                  dispatch({ type: "MOVE_SP", mi, zi, si, from: draggingSpIdx, to: pi });
                }
                setDraggingSpIdx(null);
                setDragOverSpIdx(null);
              }}
            >
              <Box
                component="span"
                className={styles.dragHandle}
                draggable
                onClick={(e) => e.stopPropagation()}
                onDragStart={(e: React.DragEvent) => {
                  e.stopPropagation();
                  e.dataTransfer.setData("text/plain", String(pi));
                  e.dataTransfer.effectAllowed = "move";
                  setDraggingSpIdx(pi);
                }}
                onDragEnd={() => { setDraggingSpIdx(null); setDragOverSpIdx(null); }}
              >
                <DragIndicatorIcon />
              </Box>
              <Box className={styles.reorderBtns}>
                <IconButton
                  size="small"
                  aria-label="Mover arriba"
                  className={styles.reorderBtn}
                  disabled={pi === 0}
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: "MOVE_SP", mi, zi, si, from: pi, to: pi - 1 }); }}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="Mover abajo"
                  className={styles.reorderBtn}
                  disabled={pi === scenario.subPrinciples.length - 1}
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: "MOVE_SP", mi, zi, si, from: pi, to: pi + 1 }); }}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </Box>
              <Box className={styles.dragRowContent}>
                <Typography className={styles.spLabel}>Subprincipio {sp.label}</Typography>
                <Typography className={styles.listItemName}>{sp.name || "Sin nombre"}</Typography>
                {sp.subSubPrinciples.length > 0 && (
                  <Chip
                    label={`${sp.subSubPrinciples.length} sub-subprincipio${sp.subSubPrinciples.length !== 1 ? "s" : ""}`}
                    size="small"
                    className={styles.countChip}
                  />
                )}
                <Tooltip title="Eliminar subprincipio">
                  <IconButton
                    size="small"
                    className={styles.deleteIconBtn}
                    onClick={(e) => { e.stopPropagation(); dispatch({ type: "DEL_SP", mi, zi, si, pi }); }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          )}
          renderDetail={(sp, pi) => <SubPrincipleDetailForm mi={mi} zi={zi} si={si} pi={pi} sp={sp} />}
        />
      </Box>
    </Box>
  );
}

// ─── ScenarioFormAccordion (default export) — one instance per Zone ─

interface Props {
  mi: number;
  zi: number;
  scenarios: Scenario[];
}

export default function ScenarioFormAccordion({ mi, zi, scenarios }: Props) {
  const { dispatch } = useGameModelDraft();
  const [selectedSi, setSelectedSi] = useState<number | null>(scenarios.length === 1 ? 0 : null);

  useEffect(() => {
    if (selectedSi !== null && selectedSi >= scenarios.length) setSelectedSi(null);
  }, [scenarios.length, selectedSi]);

  return (
    <DrillDownPanel<Scenario>
      items={scenarios}
      getKey={(s) => s.id}
      selectedIndex={selectedSi}
      onSelect={setSelectedSi}
      onBack={() => setSelectedSi(null)}
      listAriaLabel="Lista de escenarios"
      emptyMessage="No hay escenarios. Añade el primero."
      detailTitle={(s) => `Escenario ${s.order}`}
      renderListFooter={
        <Button
          size="small"
          startIcon={<AddIcon />}
          className={styles.addBtn}
          onClick={() => dispatch({ type: "ADD_SCENARIO", mi, zi })}
        >
          Añadir escenario
        </Button>
      }
      renderListItem={(scenario, si) => (
        <Box className={styles.listItemContent}>
          <Typography className={styles.scenarioNumber}>Escenario {scenario.order}</Typography>
          <Typography className={styles.listItemName}>{scenario.name || "Sin nombre"}</Typography>
          {scenario.subPrinciples.length > 0 && (
            <Chip
              label={`${scenario.subPrinciples.length} subprincipio${scenario.subPrinciples.length !== 1 ? "s" : ""}`}
              size="small"
              className={styles.countChip}
            />
          )}
          <Tooltip title="Eliminar escenario">
            <IconButton
              size="small"
              className={styles.deleteIconBtn}
              onClick={(e) => { e.stopPropagation(); dispatch({ type: "DEL_SCENARIO", mi, zi, si }); }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      renderDetail={(scenario, si) => <ScenarioDetailForm mi={mi} zi={zi} si={si} scenario={scenario} />}
    />
  );
}
```

Note: `dispatch({ type: "UPD_SSP", ... })` label text queries in the test file (`getByPlaceholderText(/Acción: describe/)`)
match the `placeholder` used above — do not change that placeholder wording.

Run `npm run test -- ScenarioFormAccordion` — must pass now.

- [x] 3.2 `ScenarioFormAccordion.tsx` rewritten, test passes (Green).

### 3.3 — Extend `ScenarioFormAccordion.module.css`

Append these new rules to the end of the file (after the block added in Task 2.2). Do not delete
existing `.accordion`/`.summary`/... rules yet — Task 4 removes the ones that become fully unused once
you've confirmed nothing else references them (grep the file for each class name before deleting).

```css
/* ── New: DrillDownPanel-based list items and detail panels ── */

.listItemContent,
.dragRowContent {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  width: 100%;
  min-width: 0;
}

.listItemName {
  font-size: 1.3rem !important;
  font-weight: 600 !important;
  color: #e8e8e8 !important;
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.detailNameField .MuiOutlinedInput-root {
  color: #e8e8e8 !important;
  font-size: 1.37rem !important;
  font-weight: 600 !important;
}

.detailNameField .MuiOutlinedInput-notchedOutline {
  border-color: rgba(77, 157, 224, 0.3) !important;
}

.detailNameField .MuiInputLabel-root {
  color: rgba(156, 220, 254, 0.6) !important;
}

.scenarioDetailForm,
.spDetailForm,
.sspDetailForm {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reorderBtns {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.reorderBtn {
  color: rgba(77, 157, 224, 0.7) !important;
  padding: 2px !important;
}

.reorderBtn:hover {
  color: #4d9de0 !important;
}

.reorderBtn:disabled {
  color: rgba(156, 220, 254, 0.15) !important;
}

/* ── Responsive: stack detail field rows and enforce touch targets below md (900px) ── */
@media (max-width: 899.95px) {
  .listItemContent,
  .dragRowContent {
    gap: 6px;
  }

  .reorderBtn,
  .deleteIconBtn,
  .dragHandle {
    min-width: 44px !important;
    min-height: 44px !important;
  }

  .addBtn {
    min-height: 44px !important;
  }
}
```

- [x] 3.3 CSS extended.

---

## 4. Wire `ScenarioFormAccordion` into `GameModelCreate.tsx` (one instance per zone)

### 4.1 — Edit `Front/src/apps/coach/pages/game-model/GameModelCreate.tsx`

Replace the `ZoneFormContent` function (currently spans roughly lines 106-148) with:

```tsx
function ZoneFormContent({
  mi,
  zi,
}: {
  mi: number;
  zi: number;
}) {
  const { draft } = useGameModelDraft();
  const zone = draft.gameMoments[mi]?.zones[zi];
  if (!zone) return null;

  return (
    <Box className={styles.zoneContent}>
      <ScenarioFormAccordion mi={mi} zi={zi} scenarios={zone.scenarios} />
    </Box>
  );
}
```

This removes the `dispatch` destructure (no longer used in this function) and the `AddIcon`-based
"Añadir escenario" button (now rendered by `ScenarioFormAccordion`'s `DrillDownPanel` footer) and the
`emptyZone`/`emptyZoneText` block (now rendered by `DrillDownPanel`'s `emptyMessage`). Check whether
`AddIcon` is still imported/used elsewhere in this file — if this was its only use, remove the now-
unused `import AddIcon from "@mui/icons-material/Add";` line to satisfy strict TS/lint.

Run `npm run build` afterward to confirm no unused-import or type errors from this change (do this once
after Task 5 too — an interim build check here is a quick sanity check, not a blocking gate).

- [x] 4.1 `ZoneFormContent` updated; unused imports cleaned up.

### 4.2 — Clean up now-unused CSS in `GameModelCreate.module.css`

Open `Front/src/apps/coach/pages/game-model/GameModelCreate.module.css` and check whether
`.emptyZone`, `.emptyZoneText`, `.addScenarioBtn` are referenced anywhere else in this CSS file's
sibling `.tsx` (they are not, per Task 4.1). Remove those three rules. If in doubt, leave them — unused
CSS is not a build error, just remove them if it's a clean, obvious deletion.

- [x] 4.2 Unused CSS rules removed (or left with a one-line note why, if ambiguous).

---

## 5. Editor: sticky mobile Save/Cancel bar (TDD)

### 5.1 — Write the test (Red)

Create `Front/src/apps/coach/pages/game-model/components/__tests__/MobileSaveCancelBar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import MobileSaveCancelBar from "../MobileSaveCancelBar";

describe("MobileSaveCancelBar", () => {
  it("invoca onSave al pulsar el botón de guardar", async () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(<MobileSaveCancelBar onSave={onSave} onCancel={onCancel} saving={false} saveLabel="Guardar Modelo" />);
    await userEvent.click(screen.getByRole("button", { name: /guardar modelo/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("invoca onCancel al pulsar cancelar", async () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(<MobileSaveCancelBar onSave={onSave} onCancel={onCancel} saving={false} saveLabel="Guardar Modelo" />);
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("deshabilita el botón de guardar mientras guarda", () => {
    render(<MobileSaveCancelBar onSave={vi.fn()} onCancel={vi.fn()} saving={true} saveLabel="Guardar Modelo" />);
    expect(screen.getByRole("button", { name: /guardando/i })).toBeDisabled();
  });
});
```

Run `npm run test -- MobileSaveCancelBar` — must fail (component doesn't exist).

- [x] 5.1 Test written and confirmed failing.

### 5.2 — Implement `MobileSaveCancelBar` (Green)

Create `Front/src/apps/coach/pages/game-model/components/MobileSaveCancelBar.tsx`:

```tsx
import { Box, Button, CircularProgress } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import styles from "./MobileSaveCancelBar.module.css";

interface Props {
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  saveLabel: string;
}

export default function MobileSaveCancelBar({ onSave, onCancel, saving, saveLabel }: Props) {
  return (
    <Box className={styles.bar} role="region" aria-label="Acciones del formulario">
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={onCancel}
        variant="outlined"
        size="small"
        className={styles.cancelBtn}
      >
        Cancelar
      </Button>
      <Button
        startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
        onClick={onSave}
        variant="contained"
        size="small"
        color="primary"
        disabled={saving}
        className={styles.saveBtn}
      >
        {saving ? "Guardando…" : saveLabel}
      </Button>
    </Box>
  );
}
```

Create `Front/src/apps/coach/pages/game-model/components/MobileSaveCancelBar.module.css`:

```css
.bar {
  display: none;
}

@media (max-width: 899.95px) {
  .bar {
    display: flex;
    gap: 8px;
    position: sticky;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px));
    margin-top: 16px;
    background-color: #07071a;
    border-top: 1px solid rgba(77, 157, 224, 0.25);
    z-index: 5;
  }
}

.cancelBtn,
.saveBtn {
  flex: 1;
  min-height: 44px !important;
}
```

Run `npm run test -- MobileSaveCancelBar` — must pass.

- [x] 5.2 `MobileSaveCancelBar` implemented, test passes (Green).

### 5.3 — Wire it into `GameModelCreate.tsx`

In `GameModelFormEditor` (inside `Front/src/apps/coach/pages/game-model/GameModelCreate.tsx`), add the
import:

```tsx
import MobileSaveCancelBar from "./components/MobileSaveCancelBar";
```

Then, immediately after the closing `</Dialog>` of the validation-error dialog and still inside the
outer `<Box className={styles.editor}>` returned by `GameModelFormEditor`, add:

```tsx
<MobileSaveCancelBar
  onSave={handleSave}
  onCancel={onCancel}
  saving={saving}
  saveLabel={isEdit ? "Guardar cambios" : "Guardar Modelo"}
/>
```

(`handleSave`, `saving`, `isEdit`, `onCancel` are all already in scope inside `GameModelFormEditor` —
no new props needed.)

- [x] 5.3 `MobileSaveCancelBar` wired into `GameModelCreate.tsx`.

---

## 6. Read view: `SubSubPrincipleCard` responsive touch-ups (TDD, no structural change)

### 6.1 — Write the test (Red)

Create `Front/src/apps/coach/pages/game-model/components/__tests__/SubSubPrincipleCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import SubSubPrincipleCard from "../SubSubPrincipleCard";
import styles from "../SubSubPrincipleCard.module.css";
import type { SubSubPrinciple } from "../../../../types/gameModel";

const ssp: SubSubPrinciple = {
  id: 1,
  order: 1,
  name: "Sub-subprincipio de prueba",
  action: "Acción de prueba",
  essentialSkills: [],
};

describe("SubSubPrincipleCard", () => {
  it("el botón de expandir lleva la clase de touch-target", () => {
    render(
      <MemoryRouter>
        <SubSubPrincipleCard index={1} subSubPrinciple={ssp} clubId="" />
      </MemoryRouter>
    );
    const expandBtn = screen.getByRole("button");
    expect(expandBtn.className).toContain(styles.expandBtn);
  });

  it("el título aplica la clase con ajuste de línea para textos largos", () => {
    render(
      <MemoryRouter>
        <SubSubPrincipleCard index={1} subSubPrinciple={ssp} clubId="" />
      </MemoryRouter>
    );
    expect(screen.getByText(/Sub-subprincipio de prueba/)).toHaveClass(styles.title);
  });
});
```

Run `npm run test -- SubSubPrincipleCard` — passes or fails depending on whether the `.title` class
already exists (it does, from the current file) — the FIRST assertion (touch-target CSS class
presence) is the meaningful Red signal here since we haven't added an `overflow-wrap` rule yet; the
test itself only checks class *names* are applied (structural), so it may pass before Task 6.2 if the
class already exists on the element. If both assertions already pass trivially before any CSS change,
that's fine — the actual pixel/overflow behavior is verified visually in Task 8.1; this test's role is
a regression guard on the classNames staying wired to the right elements.

- [ ] 6.1 Test written; run once to see current state (informational, not a hard Red gate for this
      particular component since it's CSS-only).

### 6.2 — Append touch-target CSS to `SubSubPrincipleCard.module.css`

Append at the end of `Front/src/apps/coach/pages/game-model/components/SubSubPrincipleCard.module.css`:

```css
/* ── Responsive: touch targets + overflow safety below md (900px) ── */
@media (max-width: 899.95px) {
  .header {
    min-height: 44px;
    padding: 12px;
  }

  .expandBtn,
  .exEditBtn,
  .exDeleteBtn,
  .addExBtn {
    min-width: 44px !important;
    min-height: 44px !important;
  }

  .title {
    overflow-wrap: anywhere;
  }

  .exercisesHeader {
    flex-wrap: wrap;
    gap: 8px;
  }
}
```

Run `npm run test -- SubSubPrincipleCard` — confirm still passing (Green).

- [ ] 6.2 CSS appended, test passes.

---

## 7. Read view: rewrite `ScenarioAccordion.tsx` (Scenario → SubPrinciple via `DrillDownPanel`, TDD)

Same API-shape change as Task 3, for the same reason: `ScenarioAccordion`'s props change from
`{ scenario, defaultExpanded, clubId, teamId, gameMomentName, zoneName }` (one instance per scenario)
to `{ scenarios, clubId, teamId, gameMomentName, zoneName }` (one instance per zone).
`SubSubPrincipleCard` stays exactly as-is (Task 6) — it is rendered as a flat list inside the
SubPrinciple detail panel, no further drill-down level, per `design.md`.

### 7.1 — Write the test (Red)

Create `Front/src/apps/coach/pages/game-model/components/__tests__/ScenarioAccordion.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Scenario } from "../../../../types/gameModel";
import ScenarioAccordion from "../ScenarioAccordion";

const mockUseMediaQuery = vi.fn();
vi.mock("@mui/material/useMediaQuery", () => ({
  default: (...args: unknown[]) => mockUseMediaQuery(...args),
}));

vi.mock("../../../../services/trainingService", () => ({
  default: { getExercises: vi.fn().mockResolvedValue([]), deleteExercise: vi.fn() },
}));

function buildScenario(id: number, order: number, subPrincipleCount = 0): Scenario {
  return {
    id,
    order,
    name: `Escenario ${order}`,
    context: `Contexto del escenario ${order}`,
    tacticalPrinciples: [],
    subPrinciples: Array.from({ length: subPrincipleCount }, (_, i) => ({
      id: id * 100 + i,
      order: i + 1,
      label: String.fromCharCode(65 + i),
      name: `Subprincipio ${String.fromCharCode(65 + i)}`,
      context: `Contexto subprincipio ${String.fromCharCode(65 + i)}`,
      tacticalPrinciples: [],
      subSubPrinciples: [],
    })),
  };
}

function renderAccordion(scenarios: Scenario[]) {
  render(
    <MemoryRouter>
      <ScenarioAccordion
        scenarios={scenarios}
        clubId="club-1"
        teamId="team-1"
        gameMomentName="Momento"
        zoneName="Zona"
      />
    </MemoryRouter>
  );
}

describe("ScenarioAccordion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMediaQuery.mockReturnValue(false);
  });

  it("muestra la lista de escenarios en escritorio", () => {
    renderAccordion([buildScenario(1, 1), buildScenario(2, 2)]);
    expect(screen.getByText("Escenario 1")).toBeInTheDocument();
    expect(screen.getByText("Escenario 2")).toBeInTheDocument();
  });

  it("selecciona automáticamente el único escenario cuando solo hay uno", () => {
    renderAccordion([buildScenario(1, 1)]);
    expect(screen.getByText("Contexto del escenario 1")).toBeInTheDocument();
  });

  it("al seleccionar un escenario en móvil se oculta la lista y aparece Volver", async () => {
    mockUseMediaQuery.mockReturnValue(true);
    renderAccordion([buildScenario(1, 1), buildScenario(2, 2)]);
    await userEvent.click(screen.getByText("Escenario 1"));
    expect(screen.getByText("Contexto del escenario 1")).toBeInTheDocument();
    expect(screen.queryByText("Escenario 2")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver" })).toBeInTheDocument();
  });

  it("muestra el detalle del subprincipio seleccionado dentro del escenario", async () => {
    renderAccordion([buildScenario(1, 1, 2)]);
    await userEvent.click(screen.getByText("Subprincipio A"));
    expect(screen.getByText("Contexto subprincipio A")).toBeInTheDocument();
  });
});
```

Run `npm run test -- ScenarioAccordion` — must fail (current component doesn't accept `scenarios` prop).

- [ ] 7.1 Test written and confirmed failing.

### 7.2 — Rewrite `ScenarioAccordion.tsx` (Green)

Replace the entire content of
`Front/src/apps/coach/pages/game-model/components/ScenarioAccordion.tsx` with:

```tsx
import { useEffect, useState } from "react";
import { Box, Typography, Chip, Button } from "@mui/material";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import EventNoteIcon from "@mui/icons-material/EventNote";
import { useNavigate, useLocation } from "react-router-dom";
import type { Scenario, SubPrinciple } from "../../../types/gameModel";
import DrillDownPanel from "./DrillDownPanel";
import SubSubPrincipleCard from "./SubSubPrincipleCard";
import styles from "./ScenarioAccordion.module.css";

interface Props {
  scenarios: Scenario[];
  clubId: string;
  teamId: string;
  gameMomentName: string;
  zoneName: string;
}

interface SpDetailProps {
  sp: SubPrinciple;
  clubId: string;
  teamId: string;
  scenario: { id: number; name: string; order: number };
  gameMomentName: string;
  zoneName: string;
}

function SubPrincipleDetailView({ sp, clubId, teamId, scenario, gameMomentName, zoneName }: SpDetailProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNewSession = () => {
    navigate(`/coach/game-model/create-session${location.search}`, {
      state: {
        gameMomentName,
        zoneName,
        scenario: { id: scenario.id, name: scenario.name, order: scenario.order },
        subPrinciple: {
          id: sp.id,
          apiId: sp.apiId ?? null,
          label: sp.label,
          name: sp.name,
          context: sp.context,
          tacticalPrinciples: sp.tacticalPrinciples,
          subSubPrincipleApiIds: sp.subSubPrinciples.map((ssp) => ssp.apiId).filter((id): id is string => id != null),
        },
        clubId,
        teamId,
      },
    });
  };

  const handleViewSessions = () => {
    navigate(`/coach/game-model/sessions${location.search}`, {
      state: {
        gameMomentName,
        zoneName,
        scenario: { id: scenario.id, name: scenario.name, order: scenario.order },
        subPrinciple: {
          id: sp.id,
          apiId: sp.apiId ?? null,
          label: sp.label,
          name: sp.name,
          tacticalPrinciples: sp.tacticalPrinciples,
        },
        teamId,
        clubId,
      },
    });
  };

  return (
    <Box className={styles.spDetailView}>
      <Box className={styles.spDetailHeader}>
        <Typography className={styles.subPrincipleName}>{sp.name.toUpperCase()}</Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<FitnessCenterIcon />}
          className={styles.newSessionBtn}
          onClick={handleNewSession}
        >
          Nueva sesión
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<EventNoteIcon />}
          className={styles.viewSessionsBtn}
          onClick={handleViewSessions}
        >
          Ver sesiones
        </Button>
      </Box>

      <Typography className={styles.subPrincipleContext}>{sp.context}</Typography>

      {sp.tacticalPrinciples.length > 0 && (
        <Box className={styles.principlesRow}>
          <Typography className={styles.principlesLabel}>Principios tácticos colectivos:</Typography>
          <Box className={styles.chipRow}>
            {sp.tacticalPrinciples.map((p) => (
              <Chip key={p.id} label={p.name} size="small" className={styles.principleChip} />
            ))}
          </Box>
        </Box>
      )}

      {sp.subSubPrinciples.length > 0 && (
        <Box className={styles.subSubPrinciples}>
          {sp.subSubPrinciples.map((ssp, idx) => (
            <SubSubPrincipleCard key={ssp.id} index={idx + 1} subSubPrinciple={ssp} clubId={clubId} />
          ))}
        </Box>
      )}
    </Box>
  );
}

interface ScenarioDetailProps {
  scenario: Scenario;
  clubId: string;
  teamId: string;
  gameMomentName: string;
  zoneName: string;
}

function ScenarioDetailView({ scenario, clubId, teamId, gameMomentName, zoneName }: ScenarioDetailProps) {
  const [selectedPi, setSelectedPi] = useState<number | null>(scenario.subPrinciples.length === 1 ? 0 : null);

  useEffect(() => {
    if (selectedPi !== null && selectedPi >= scenario.subPrinciples.length) setSelectedPi(null);
  }, [scenario.subPrinciples.length, selectedPi]);

  return (
    <Box className={styles.scenarioDetailView}>
      <Typography className={styles.context}>{scenario.context}</Typography>

      {scenario.tacticalPrinciples.length > 0 && (
        <Box className={styles.principlesRow}>
          <Typography className={styles.principlesLabel}>Principios tácticos colectivos:</Typography>
          <Box className={styles.chipRow}>
            {scenario.tacticalPrinciples.map((p) => (
              <Chip key={p.id} label={p.name} size="small" className={styles.principleChip} />
            ))}
          </Box>
        </Box>
      )}

      {scenario.subPrinciples.length > 0 ? (
        <DrillDownPanel<SubPrinciple>
          items={scenario.subPrinciples}
          getKey={(sp) => sp.id}
          selectedIndex={selectedPi}
          onSelect={setSelectedPi}
          onBack={() => setSelectedPi(null)}
          listAriaLabel="Lista de subprincipios"
          emptyMessage="Selecciona un subprincipio para ver su detalle."
          detailTitle={(sp) => `Subprincipio ${sp.label}`}
          renderListItem={(sp) => (
            <Box className={styles.listItemContent}>
              <Typography className={styles.subPrincipleLabel}>Subprincipio {sp.label}</Typography>
              <Typography className={styles.listItemName}>{sp.name.toUpperCase()}</Typography>
              {sp.subSubPrinciples.length > 0 && (
                <Chip
                  label={`${sp.subSubPrinciples.length} sub-subprincipio${sp.subSubPrinciples.length !== 1 ? "s" : ""}`}
                  size="small"
                  className={styles.countChip}
                />
              )}
            </Box>
          )}
          renderDetail={(sp) => (
            <SubPrincipleDetailView
              sp={sp}
              clubId={clubId}
              teamId={teamId}
              scenario={{ id: scenario.id, name: scenario.name, order: scenario.order }}
              gameMomentName={gameMomentName}
              zoneName={zoneName}
            />
          )}
        />
      ) : (
        <Typography className={styles.emptyZoneText}>No hay subprincipios definidos.</Typography>
      )}
    </Box>
  );
}

export default function ScenarioAccordion({ scenarios, clubId, teamId, gameMomentName, zoneName }: Props) {
  const [selectedSi, setSelectedSi] = useState<number | null>(scenarios.length === 1 ? 0 : null);

  useEffect(() => {
    if (selectedSi !== null && selectedSi >= scenarios.length) setSelectedSi(null);
  }, [scenarios.length, selectedSi]);

  return (
    <DrillDownPanel<Scenario>
      items={scenarios}
      getKey={(s) => s.id}
      selectedIndex={selectedSi}
      onSelect={setSelectedSi}
      onBack={() => setSelectedSi(null)}
      listAriaLabel="Lista de escenarios"
      emptyMessage="Selecciona un escenario para ver su detalle."
      detailTitle={(s) => `Escenario ${s.order}`}
      renderListItem={(scenario) => (
        <Box className={styles.listItemContent}>
          <Typography className={styles.scenarioNumber}>Escenario {scenario.order}</Typography>
          <Typography className={styles.listItemName}>{scenario.name}</Typography>
          {scenario.subPrinciples.length > 0 && (
            <Chip
              label={`${scenario.subPrinciples.length} subprincipio${scenario.subPrinciples.length !== 1 ? "s" : ""}`}
              size="small"
              className={styles.countChip}
            />
          )}
        </Box>
      )}
      renderDetail={(scenario) => (
        <ScenarioDetailView
          scenario={scenario}
          clubId={clubId}
          teamId={teamId}
          gameMomentName={gameMomentName}
          zoneName={zoneName}
        />
      )}
    />
  );
}
```

Run `npm run test -- ScenarioAccordion` — must pass now.

- [ ] 7.2 `ScenarioAccordion.tsx` rewritten, test passes (Green).

### 7.3 — Extend `ScenarioAccordion.module.css`

Append at the end of `Front/src/apps/coach/pages/game-model/components/ScenarioAccordion.module.css`:

```css
/* ── New: DrillDownPanel-based list items and detail panels ── */

.listItemContent {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  width: 100%;
  min-width: 0;
}

.listItemName {
  font-size: 1.3rem !important;
  font-weight: 600 !important;
  color: #e8e8e8 !important;
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.scenarioDetailView,
.spDetailView {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.spDetailHeader {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* ── Responsive: stack header actions and enforce touch targets below md (900px) ── */
@media (max-width: 899.95px) {
  .spDetailHeader {
    flex-direction: column;
    align-items: stretch;
  }

  .newSessionBtn,
  .viewSessionsBtn {
    margin-left: 0 !important;
    min-height: 44px !important;
    width: 100%;
  }

  .listItemContent {
    gap: 6px;
  }
}
```

- [ ] 7.3 CSS extended.

### 7.4 — Wire the new `ScenarioAccordion` shape into `GameModel.tsx`

In `Front/src/apps/coach/pages/game-model/GameModel.tsx`, replace the `ZoneContent` function
(currently spans roughly lines 36-63) with:

```tsx
function ZoneContent({
  zone, clubId, teamId, gameMomentName,
}: { zone: Zone; clubId: string; teamId: string; gameMomentName: string }) {
  if (zone.scenarios.length === 0) {
    return (
      <Box className={styles.emptyZone}>
        <Typography className={styles.emptyZoneText}>
          No hay escenarios definidos para esta zona.
        </Typography>
      </Box>
    );
  }
  return (
    <Box className={styles.scenarios}>
      <ScenarioAccordion
        scenarios={zone.scenarios}
        clubId={clubId}
        teamId={teamId}
        gameMomentName={gameMomentName}
        zoneName={zone.name}
      />
    </Box>
  );
}
```

This is the only change needed to `GameModel.tsx`. Everything else in that file (Moment/Zone `Tabs`,
season dialogs, `GameModelPrintView` usage) is untouched — verify with a diff that no other lines
changed.

- [ ] 7.4 `GameModel.tsx`'s `ZoneContent` updated; confirm no other part of the file changed.

---

## 8. Cross-cutting verification

- [x] 8.1 Manually verify (or, if `npm run dev` isn't practical in this environment, carefully trace
      through the CSS/media queries you wrote and state the expected result per breakpoint in your
      final report) at 320px, 768px, 1024px, and 1440px: no horizontal scroll, Moment/Zone `Tabs`
      unaffected (you did not touch that code), drill-down works below 900px (`DrillDownPanel`'s
      `isMobile` branch), master-detail works at/above 900px, move-up/move-down buttons functional and
      correctly disabled at boundaries (covered by the Task 3.1 test), sticky Save bar visible while
      scrolled in the mobile editor (`MobileSaveCancelBar`'s `position: sticky` under the 899.95px
      query).
- [x] 8.2 Run `npm run build` in `Front/` — must pass with zero TypeScript errors. Fix anything you
      introduced (unused imports, generic type inference issues on `DrillDownPanel<T>` call sites are
      the most likely source — make sure every `DrillDownPanel<X>` call site's `renderListItem`/
      `renderDetail` callbacks return `ReactNode`, not `void`).
- [x] 8.3 Run `npm run test` in `Front/` — full suite must pass, 100% pass rate, no skipped tests. This
      includes every pre-existing test in the repo, not just the ones you added — if something you
      touched (e.g. `GameModelCreate.tsx`, `GameModel.tsx`) breaks an existing test elsewhere, fix your
      change, don't weaken the test.
- [x] 8.4 Confirm `Front/src/apps/coach/pages/game-model/components/GameModelPrintView.tsx` was not
      modified (`git diff --stat` should not list it) and that `GameModel.tsx` still passes it the same
      `gameModel`/`teamName`/`season` props as before your change.

---

## Final report

When done, produce the standard `openspec-implementer` final report (per your agent instructions),
plus explicitly call out this known, intentional deviation from a literal reading of `design.md`:

> `ScenarioAccordion` and `ScenarioFormAccordion` changed their prop shape from "one instance per
> scenario" to "one instance per zone, rendering the whole scenario list via `DrillDownPanel`". This
> was necessary because the approved spec (`specs/game-model-responsive-navigation/spec.md`) requires
> drill-down/master-detail navigation AT the Scenario level, not only below it — the original
> per-scenario component signature could not satisfy that. `GameModel.tsx` and `GameModelCreate.tsx`
> were updated accordingly (one call site each, replacing a `.map()` over scenarios).
