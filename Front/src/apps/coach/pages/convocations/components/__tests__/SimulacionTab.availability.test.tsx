import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

function baseSimReturn(): UseMatchSimulationReturn {
  return {
    currentMinute: 0,
    currentSecond: 0,
    isRunning: false,
    half: 1,
    isHalftime: false,
    slots: {},
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
  };
}

const lineupPlayers: SquadPlayer[] = [
  {
    id: "p1",
    displayName: "Jugador Uno",
    dorsal: 7,
    position: "Delantero",
    availability: 33,
    physicalFitness: 55,
    fatigue: 22,
  },
];

describe("SimulacionTab - indicador de disponibilidad", () => {
  it("muestra la disponibilidad del jugador en la tarjeta del banquillo", async () => {
    useMatchSimulationMock.mockReturnValue(baseSimReturn());

    render(<SimulacionTab teamId="team-1" eventId="event-1" lineupPlayers={lineupPlayers} />);

    expect(await screen.findByText("33%")).toBeInTheDocument();
  });

  it("muestra la leyenda de Disponibilidad en el banquillo", async () => {
    useMatchSimulationMock.mockReturnValue(baseSimReturn());

    render(<SimulacionTab teamId="team-1" eventId="event-1" lineupPlayers={lineupPlayers} />);

    await screen.findByText("33%");
    const availabilityLegend = screen.getByLabelText("Leyenda de Disponibilidad");
    expect(within(availabilityLegend).getByText("≥80")).toBeInTheDocument();
    expect(within(availabilityLegend).getByText("50-79")).toBeInTheDocument();
    expect(within(availabilityLegend).getByText("<50")).toBeInTheDocument();
  });
});
