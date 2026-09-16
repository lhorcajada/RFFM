import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import SimulacionTab from "../SimulacionTab";
import type { UseMatchSimulationReturn } from "../../hooks/useMatchSimulation";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";

// ─────────────────────────────────────────────────────────────────────────────
// Regression guard, React side: proves the compact draggable bench card tree
// (DraggableCompactBenchCard/DroppableBench, the interactive "Banquillo" side
// panel) is still rendered in the DOM when prepareMode is true. The panel now
// uses compact cards (same visual language as the field), not the rich
// BenchPlayerCard — that rich card now only lives in the read-only info block
// (see SimulacionTab.benchInfoPanel.test.tsx), so the player's name can
// legitimately appear twice in the page: once (compact, draggable) in the
// side panel, once (rich, read-only) in the info block below. This test
// scopes its queries to the side panel to avoid ambiguity.
// ─────────────────────────────────────────────────────────────────────────────

const useMatchSimulationMock = vi.fn();

vi.mock("../../../../services/teamService", () => ({
  getTeamById: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../hooks/useMatchSimulation", () => ({
  useMatchSimulation: (...args: unknown[]) => useMatchSimulationMock(...args),
}));

vi.mock("../simulation/SubstitutionWindowTracker", () => ({
  default: () => <div data-testid="substitution-window-tracker" />,
}));

vi.mock("../../../../services/idealLineupService", () => ({
  getIdealLineup: vi.fn().mockResolvedValue({
    id: "lineup-1",
    formationId: "f1",
    slots: [],
  }),
}));

vi.mock("../../../../services/formationService", () => ({
  getFormations: vi.fn().mockResolvedValue([{ id: "f1", name: "4-4-2" }]),
}));

vi.mock("../../../../services/simulationService", () => ({
  listSimulations: vi.fn().mockReturnValue([]),
  saveSimulation: vi.fn(),
  deleteSimulation: vi.fn(),
}));

function baseSimReturn(overrides: Partial<UseMatchSimulationReturn> = {}): UseMatchSimulationReturn {
  return {
    currentMinute: 0,
    currentSecond: 0,
    isRunning: false,
    half: 1,
    isHalftime: false,
    slots: { 0: "p1" },
    playerStates: {},
    playerMinutes: {},
    windows: [],
    prepareMode: false,
    prepareSlotsPreview: {},
    lastCommittedWindow: null,
    initialized: true,
    isFinished: false,
    isMatchOver: false,
    isLoadedFromSave: false,
    initialSlots: {},
    halfDuration: 35,
    windowsTotal: 0,
    windowsInSecondHalf: 0,
    canOpenWindow: true,
    initSimulation: vi.fn(),
    loadSimulation: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    reset: vi.fn(),
    finishMatch: vi.fn(),
    setHalfDuration: vi.fn(),
    jumpToMinute: vi.fn(),
    advanceBy: vi.fn(),
    startSecondHalf: vi.fn(),
    startHalftime: vi.fn(),
    startPrepare: vi.fn(),
    cancelPrepare: vi.fn(),
    movePreparePlayer: vi.fn(),
    movePreparePlayerToBench: vi.fn(),
    commitWindow: vi.fn(),
    dismissConfirmation: vi.fn(),
    toMatchSimulation: vi.fn(),
    ...overrides,
  };
}

const lineupPlayers: SquadPlayer[] = [
  { id: "p1", displayName: "Titular Uno", dorsal: 7, position: "Delantero", competitiveness: 8 },
  { id: "p2", displayName: "SuplenteDraggable Dos", dorsal: 12, position: "Defensa", competitiveness: 6 },
];

describe("SimulacionTab - el banquillo lateral compacto sigue siendo arrastrable (Preparar cambio)", () => {
  it("en prepareMode, la tarjeta compacta del jugador de banquillo se renderiza en el panel lateral, envuelta en un wrapper arrastrable", async () => {
    useMatchSimulationMock.mockReturnValue(
      baseSimReturn({ prepareMode: true, prepareSlotsPreview: { 0: "p1" } }),
    );

    render(<SimulacionTab teamId="team-1" eventId="event-1" lineupPlayers={lineupPlayers} />);

    const heading = await screen.findByText("Disponibles para el cambio");
    const sidePanel = heading.closest("div")!.parentElement as HTMLElement;

    const card = within(sidePanel).getByText("SuplenteDraggable Dos");
    expect(card).toBeInTheDocument();
    // The compact card is wrapped by CompactBenchCard.module.css's dragHandle
    // class when draggable, and does NOT carry BenchPlayerCard's rich markup
    // (no competitiveness/streak badges) in the side panel.
    expect(card.closest("[class*='dragHandle']")).not.toBeNull();
    expect(within(sidePanel).queryByText(/Comp\./)).not.toBeInTheDocument();
  });
});
