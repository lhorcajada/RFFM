import { describe, it, expect, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SimulacionTab from "../SimulacionTab";
import type { UseMatchSimulationReturn } from "../../hooks/useMatchSimulation";
import { getTeamById } from "../../../../services/teamService";
import type { TeamResponse } from "../../../../services/teamService";

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
    slots: [{ slotIndex: 0, teamPlayerId: "p1" }],
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

vi.mock("../../../../services/teamService", () => ({
  getTeamById: vi.fn(),
}));

function baseTeam(overrides: Partial<TeamResponse> = {}): TeamResponse {
  return {
    id: "team-1",
    name: "Equipo Test",
    category: { id: 1, name: "Alevín" },
    league: {},
    club: {
      id: "club-1",
      name: "Club Test",
      country: { id: 1, name: "España", code: "ES" },
    },
    canEdit: true,
    standardHalfDurationMinutes: null,
    ...overrides,
  };
}

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

describe("SimulacionTab - default half duration by team category", () => {
  it("applies the category's standard half duration once the team resolves", async () => {
    const sim = baseSimReturn();
    useMatchSimulationMock.mockReturnValue(sim);
    vi.mocked(getTeamById).mockResolvedValue(
      baseTeam({ standardHalfDurationMinutes: 30 }),
    );

    render(<SimulacionTab teamId="team-1" eventId="event-1" lineupPlayers={[]} />);

    await waitFor(() => expect(sim.setHalfDuration).toHaveBeenCalledWith(30));
  });

  it("keeps the hardcoded default when the category has no standard half duration", async () => {
    const sim = baseSimReturn();
    useMatchSimulationMock.mockReturnValue(sim);
    vi.mocked(getTeamById).mockResolvedValue(
      baseTeam({ standardHalfDurationMinutes: null }),
    );

    render(<SimulacionTab teamId="team-1" eventId="event-1" lineupPlayers={[]} />);

    await waitFor(() => expect(getTeamById).toHaveBeenCalledWith("team-1"));
    expect(sim.setHalfDuration).not.toHaveBeenCalled();
    expect(screen.getByText("35 min/parte")).toBeInTheDocument();
  });

  it("does not overwrite a manual half-duration change once the team resolves", async () => {
    const sim = baseSimReturn();
    useMatchSimulationMock.mockReturnValue(sim);

    let resolveTeam: (team: TeamResponse) => void = () => {};
    vi.mocked(getTeamById).mockReturnValue(
      new Promise<TeamResponse>((resolve) => {
        resolveTeam = resolve;
      }),
    );

    render(<SimulacionTab teamId="team-1" eventId="event-1" lineupPlayers={[]} />);

    const user = userEvent.setup();
    await user.click(await screen.findByTitle("Configuración del partido"));
    await user.click(screen.getByRole("button", { name: "40'" }));

    expect(sim.setHalfDuration).toHaveBeenCalledWith(40);
    sim.setHalfDuration.mockClear();

    await act(async () => {
      resolveTeam(baseTeam({ standardHalfDurationMinutes: 30 }));
      await Promise.resolve();
    });

    await waitFor(() => expect(getTeamById).toHaveBeenCalledWith("team-1"));
    expect(sim.setHalfDuration).not.toHaveBeenCalledWith(30);
  });
});
