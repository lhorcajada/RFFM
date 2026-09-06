import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import SimulacionTab from "../SimulacionTab";
import type { UseMatchSimulationReturn } from "../../hooks/useMatchSimulation";
import { getIdealLineup } from "../../../../services/idealLineupService";
import { getFormations } from "../../../../services/formationService";

const useMatchSimulationMock = vi.fn();

vi.mock("../../hooks/useMatchSimulation", () => ({
  useMatchSimulation: (...args: unknown[]) => useMatchSimulationMock(...args),
}));

vi.mock("../simulation/SubstitutionWindowTracker", () => ({
  default: (props: { unlimitedWindows?: boolean }) => (
    <div data-testid="substitution-window-tracker" data-unlimited={String(!!props.unlimitedWindows)} />
  ),
}));

vi.mock("../../../../services/idealLineupService", () => ({
  getIdealLineup: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../../services/formationService", () => ({
  getFormations: vi.fn().mockResolvedValue([]),
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
    initialized: false,
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

describe("SimulacionTab - threading isFriendly into useMatchSimulation", () => {
  it("calls useMatchSimulation with enableWindowLimits:false when isFriendly is true", () => {
    useMatchSimulationMock.mockReturnValue(baseSimReturn());

    render(<SimulacionTab teamId="team-1" eventId="event-1" lineupPlayers={[]} isFriendly />);

    expect(useMatchSimulationMock).toHaveBeenCalledWith({ enableWindowLimits: false });
  });

  it("calls useMatchSimulation with enableWindowLimits:true when isFriendly is false/omitted", () => {
    useMatchSimulationMock.mockReturnValue(baseSimReturn());

    render(<SimulacionTab teamId="team-1" eventId="event-1" lineupPlayers={[]} />);

    expect(useMatchSimulationMock).toHaveBeenCalledWith({ enableWindowLimits: true });
  });
});

describe("SimulacionTab - threading isFriendly into SubstitutionWindowTracker", () => {
  const formation = { id: "formation-1", name: "4-4-2", description: null };
  const lineup = {
    formationId: "formation-1",
    slots: [{ slotIndex: 0, teamPlayerId: "player-1" }],
  };

  it("passes unlimitedWindows=true to SubstitutionWindowTracker when isFriendly is true", async () => {
    vi.mocked(getFormations).mockResolvedValueOnce([formation]);
    vi.mocked(getIdealLineup).mockResolvedValueOnce(lineup);
    useMatchSimulationMock.mockReturnValue({ ...baseSimReturn(), initialized: true });

    render(<SimulacionTab teamId="team-1" eventId="event-1" lineupPlayers={[]} isFriendly />);

    await waitFor(() =>
      expect(screen.getByTestId("substitution-window-tracker")).toHaveAttribute(
        "data-unlimited",
        "true",
      ),
    );
  });

  it("passes unlimitedWindows=false to SubstitutionWindowTracker when isFriendly is false/omitted", async () => {
    vi.mocked(getFormations).mockResolvedValueOnce([formation]);
    vi.mocked(getIdealLineup).mockResolvedValueOnce(lineup);
    useMatchSimulationMock.mockReturnValue({ ...baseSimReturn(), initialized: true });

    render(<SimulacionTab teamId="team-1" eventId="event-1" lineupPlayers={[]} />);

    await waitFor(() =>
      expect(screen.getByTestId("substitution-window-tracker")).toHaveAttribute(
        "data-unlimited",
        "false",
      ),
    );
  });
});
