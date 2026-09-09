import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SimulacionTab from "../SimulacionTab";
import type { UseMatchSimulationReturn } from "../../hooks/useMatchSimulation";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";

const useMatchSimulationMock = vi.fn();

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

function baseSimReturn(playerMinutes: Record<string, number>): UseMatchSimulationReturn {
  return {
    currentMinute: 0,
    currentSecond: 0,
    isRunning: false,
    half: 1,
    isHalftime: false,
    slots: {},
    playerStates: {},
    playerMinutes,
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
  };
}

// trainingComponent 60, matchMinutesInWindow 0 de 560 esperados -> readiness original = round(0.7*60) = 42
const lineupPlayers: SquadPlayer[] = [
  {
    id: "p1",
    displayName: "Jugador Uno",
    dorsal: 7,
    position: "Delantero",
    readiness: 42,
    readinessBreakdown: {
      trainingComponent: 60,
      matchMinutesInWindow: 0,
      matchMinutesExpected: 560,
    },
  },
];

describe("SimulacionTab - rodaje en vivo", () => {
  it("sube el % de rodaje mostrado en la tarjeta del banquillo al acumular minutos en la simulación en curso", async () => {
    useMatchSimulationMock.mockReturnValue(baseSimReturn({ p1: 56 }));

    render(<SimulacionTab teamId="team-1" eventId="event-1" lineupPlayers={lineupPlayers} />);

    // matchComponent = 56/560*100 = 10; readiness = round(0.7*60 + 0.3*10) = 45
    expect(await screen.findByText("45%")).toBeInTheDocument();
    expect(screen.queryByText("42%")).not.toBeInTheDocument();
  });

  it("con 0 minutos en la simulación en curso, muestra el mismo % que el rodaje original", async () => {
    useMatchSimulationMock.mockReturnValue(baseSimReturn({}));

    render(<SimulacionTab teamId="team-1" eventId="event-1" lineupPlayers={lineupPlayers} />);

    expect(await screen.findByText("42%")).toBeInTheDocument();
  });
});
