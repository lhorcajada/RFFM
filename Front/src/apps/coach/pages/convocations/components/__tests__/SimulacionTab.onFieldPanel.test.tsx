import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import SimulacionTab from "../SimulacionTab";
import type { UseMatchSimulationReturn } from "../../hooks/useMatchSimulation";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";

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
  { id: "p1", displayName: "JugadorCampo Titular", dorsal: 7, position: "Delantero", competitiveness: 8 },
  { id: "p2", displayName: "Jugador Banquillo", dorsal: 12, position: "Defensa", competitiveness: 6 },
];

describe("SimulacionTab - listado 'En el campo' (solo lectura, tablet)", () => {
  it("muestra a los jugadores en el campo, no a los del banquillo, sin controles de arrastre", async () => {
    useMatchSimulationMock.mockReturnValue(baseSimReturn());

    render(<SimulacionTab teamId="team-1" eventId="event-1" lineupPlayers={lineupPlayers} />);

    const heading = await screen.findByText("En el campo");
    const onFieldPanel = heading.closest("div")!.parentElement as HTMLElement;

    expect(within(onFieldPanel).getByText("JugadorCampo Titular")).toBeInTheDocument();
    expect(within(onFieldPanel).queryByText("Jugador Banquillo")).not.toBeInTheDocument();
    // read-only: no drag handle wrapper class present for this card
    expect(onFieldPanel.querySelector("[class*='benchDragHandle']")).not.toBeInTheDocument();
  });

  it("durante prepareMode, 'En el campo' refleja la vista previa, no el campo real", async () => {
    useMatchSimulationMock.mockReturnValue(
      baseSimReturn({
        prepareMode: true,
        prepareSlotsPreview: { 0: "p2" },
      }),
    );

    render(<SimulacionTab teamId="team-1" eventId="event-1" lineupPlayers={lineupPlayers} />);

    const heading = await screen.findByText("En el campo");
    const onFieldPanel = heading.closest("div")!.parentElement as HTMLElement;

    expect(within(onFieldPanel).getByText("Jugador Banquillo")).toBeInTheDocument();
    expect(within(onFieldPanel).queryByText("JugadorCampo Titular")).not.toBeInTheDocument();
  });
});
