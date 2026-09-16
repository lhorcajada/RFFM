import { describe, it, expect, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import SimulacionTab from "../SimulacionTab";
import type { UseMatchSimulationReturn } from "../../hooks/useMatchSimulation";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";

// ─────────────────────────────────────────────────────────────────────────────
// New read-only "Banquillo" info panel (rich BenchPlayerCard), always visible
// alongside the existing "En el campo" info panel — sibling of the compact,
// draggable side panel (see SimulacionTab.benchDraggable.test.tsx).
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
    playerMinutes: { p1: 12 },
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
  { id: "p1", displayName: "TitularCampo Uno", dorsal: 7, position: "Delantero", competitiveness: 8 },
  { id: "p2", displayName: "BanquilloRico Dos", dorsal: 12, position: "Defensa", competitiveness: 6, streakCount: 2 },
];

describe("SimulacionTab - listado informativo 'Banquillo' (tarjeta rica, solo lectura, siempre visible)", () => {
  it("muestra los jugadores del banquillo con información completa, en un panel informativo dedicado (.benchInfoPanel)", async () => {
    useMatchSimulationMock.mockReturnValue(baseSimReturn());

    const { container } = render(
      <SimulacionTab teamId="team-1" eventId="event-1" lineupPlayers={lineupPlayers} />,
    );

    const infoPanel = await waitFor(() => {
      const el = container.querySelector("[class*='benchInfoPanel']");
      if (!el) throw new Error("not yet rendered");
      return el;
    });
    expect(infoPanel).not.toBeNull();
    expect(within(infoPanel as HTMLElement).getByText("BanquilloRico Dos")).toBeInTheDocument();
    expect(
      within(infoPanel as HTMLElement).getByText(
        (_, el) => el?.textContent?.replace(/\s+/g, " ").trim() === "Comp. 6",
      ),
    ).toBeInTheDocument();
  });

  it("el listado informativo no es arrastrable (sin wrapper dragHandle/benchDragHandle)", async () => {
    useMatchSimulationMock.mockReturnValue(baseSimReturn());

    const { container } = render(
      <SimulacionTab teamId="team-1" eventId="event-1" lineupPlayers={lineupPlayers} />,
    );

    const infoPanel = await waitFor(() => {
      const el = container.querySelector("[class*='benchInfoPanel']");
      if (!el) throw new Error("not yet rendered");
      return el;
    });
    const card = within(infoPanel as HTMLElement).getByText("BanquilloRico Dos");
    expect(card.closest("[class*='dragHandle']")).toBeNull();
    expect(card.closest("[class*='benchDragHandle']")).toBeNull();
  });

  it("el bloque informativo se muestra aunque no se esté en prepareMode (siempre visible)", async () => {
    useMatchSimulationMock.mockReturnValue(baseSimReturn({ prepareMode: false }));

    render(<SimulacionTab teamId="team-1" eventId="event-1" lineupPlayers={lineupPlayers} />);

    expect(await screen.findByText("En el campo")).toBeInTheDocument();
  });
});
