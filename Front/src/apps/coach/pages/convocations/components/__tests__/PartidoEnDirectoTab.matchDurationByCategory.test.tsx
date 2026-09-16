import { describe, it, expect, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PartidoEnDirectoTab from "../PartidoEnDirectoTab";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";
import { getTeamById } from "../../../../services/teamService";
import type { TeamResponse } from "../../../../services/teamService";

const useLiveMatchMock = vi.fn();

vi.mock("../../../../services/formationService", () => ({
  getFormations: vi.fn().mockResolvedValue([{ id: "f1", name: "4-4-2" }]),
}));

vi.mock("../../../../services/idealLineupService", () => ({
  getIdealLineup: vi.fn().mockResolvedValue({
    id: "lineup-1",
    formationId: "f1",
    slots: Array.from({ length: 11 }, (_, i) => ({ slotIndex: i, teamPlayerId: `p${i}` })),
  }),
}));

vi.mock("../../../../services/liveMatchService", () => ({
  saveMatchParticipation: vi.fn().mockResolvedValue(undefined),
  getMatchParticipation: vi.fn().mockResolvedValue(null),
  deleteMatchParticipation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../simulation/SubstitutionWindowTracker", () => ({
  default: () => <div data-testid="substitution-window-tracker" />,
}));

vi.mock("../../../../services/teamService", () => ({
  getTeamById: vi.fn(),
}));

vi.mock("../../hooks/useLiveMatch", () => ({
  useLiveMatch: (...args: unknown[]) => useLiveMatchMock(...args),
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

function buildSlots() {
  const slots: Record<number, string | null> = {};
  for (let i = 0; i < 11; i++) slots[i] = `p${i}`;
  return slots;
}

function baseLiveReturn() {
  return {
    matchPhase: "preMatch",
    currentMinute: 0,
    currentSecond: 0,
    half: 1,
    isHalftime: false,
    halfDuration: 45,
    setHalfDuration: vi.fn(),
    slots: buildSlots(),
    playerStates: {},
    playerMinutes: {},
    initialSlots: buildSlots(),
    initialized: true,
    windows: [],
    prepareMode: false,
    prepareSlotsPreview: {},
    lastCommittedWindow: null,
    windowsTotal: 0,
    windowsInSecondHalf: 0,
    canOpenWindow: true,
    goals: [],
    scoreLocal: 0,
    scoreVisitor: 0,
    cards: [],
    formationChanges: [],
    unlimitedWindows: false,
    ratingSnapshots: [],
    pendingAction: null,
    setPendingAction: vi.fn(),
    isSaving: false,
    saveError: null,
    isSaveConfirmOpen: false,
    requestSave: vi.fn(),
    confirmSave: vi.fn(),
    cancelSave: vi.fn(),
    hasSavedData: false,
    savedParticipationData: null,
    isDeleting: false,
    deleteParticipation: vi.fn(),
    backup: null,
    initMatch: vi.fn(),
    confirmAction: vi.fn(),
    cancelAction: vi.fn(),
    addGoal: vi.fn(),
    removeGoal: vi.fn(),
    addCard: vi.fn(),
    removeCard: vi.fn(),
    changeFormation: vi.fn(),
    startPrepare: vi.fn(),
    cancelPrepare: vi.fn(),
    movePreparePlayer: vi.fn(),
    movePreparePlayerToBench: vi.fn(),
    commitWindow: vi.fn(),
    repositionPlayer: vi.fn(),
    dismissConfirmation: vi.fn(),
    dismissSaveError: vi.fn(),
    acceptBackup: vi.fn(),
    discardBackup: vi.fn(),
  };
}

const lineupPlayers: SquadPlayer[] = Array.from({ length: 11 }, (_, i) => ({
  id: `p${i}`,
  displayName: `Jugador ${i}`,
  alias: null,
  photoSrc: null,
  dorsal: i + 1,
  position: i === 0 ? "portero" : "defensa",
  competitiveness: 7,
}));

describe("PartidoEnDirectoTab - default half duration by team category", () => {
  it("applies the category's standard half duration once the team resolves and the match is still preMatch", async () => {
    const live = baseLiveReturn();
    useLiveMatchMock.mockReturnValue(live);
    vi.mocked(getTeamById).mockResolvedValue(
      baseTeam({ standardHalfDurationMinutes: 30 }),
    );

    render(
      <PartidoEnDirectoTab
        teamId="team-1"
        eventId="event-1"
        lineupPlayers={lineupPlayers}
        localTeamName="Local FC"
        visitorTeamName="Visitor FC"
        isHomeTeam
      />,
    );

    await waitFor(() => expect(live.setHalfDuration).toHaveBeenCalledWith(30));
  });

  it("keeps the hardcoded default when the category has no standard half duration", async () => {
    const live = baseLiveReturn();
    useLiveMatchMock.mockReturnValue(live);
    vi.mocked(getTeamById).mockResolvedValue(
      baseTeam({ standardHalfDurationMinutes: null }),
    );

    render(
      <PartidoEnDirectoTab
        teamId="team-1"
        eventId="event-1"
        lineupPlayers={lineupPlayers}
        localTeamName="Local FC"
        visitorTeamName="Visitor FC"
        isHomeTeam
      />,
    );

    await waitFor(() => expect(getTeamById).toHaveBeenCalledWith("team-1"));
    expect(live.setHalfDuration).not.toHaveBeenCalled();
  });

  it("does not overwrite a manual half-duration change once the team resolves", async () => {
    const live = baseLiveReturn();
    useLiveMatchMock.mockReturnValue(live);

    let resolveTeam: (team: TeamResponse) => void = () => {};
    vi.mocked(getTeamById).mockReturnValue(
      new Promise<TeamResponse>((resolve) => {
        resolveTeam = resolve;
      }),
    );

    render(
      <PartidoEnDirectoTab
        teamId="team-1"
        eventId="event-1"
        lineupPlayers={lineupPlayers}
        localTeamName="Local FC"
        visitorTeamName="Visitor FC"
        isHomeTeam
      />,
    );

    const user = userEvent.setup();
    await user.click(await screen.findByTitle("Configuración del partido"));
    await user.click(screen.getByRole("button", { name: "40'" }));

    expect(live.setHalfDuration).toHaveBeenCalledWith(40);
    live.setHalfDuration.mockClear();

    await act(async () => {
      resolveTeam(baseTeam({ standardHalfDurationMinutes: 30 }));
      await Promise.resolve();
    });

    await waitFor(() => expect(getTeamById).toHaveBeenCalledWith("team-1"));
    expect(live.setHalfDuration).not.toHaveBeenCalledWith(30);
  });
});
