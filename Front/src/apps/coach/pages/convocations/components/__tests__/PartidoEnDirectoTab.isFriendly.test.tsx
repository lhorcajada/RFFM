import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PartidoEnDirectoTab from "../PartidoEnDirectoTab";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";

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
  default: (props: { unlimitedWindows?: boolean }) => (
    <div data-testid="substitution-window-tracker" data-unlimited={String(!!props.unlimitedWindows)} />
  ),
}));

function buildSlots() {
  const slots: Record<number, string | null> = {};
  for (let i = 0; i < 11; i++) slots[i] = `p${i}`;
  return slots;
}

function baseLiveReturn(unlimitedWindows: boolean) {
  return {
    matchPhase: "firstHalf",
    currentMinute: 10,
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
    unlimitedWindows,
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

vi.mock("../../hooks/useLiveMatch", () => ({
  useLiveMatch: (...args: unknown[]) => useLiveMatchMock(...args),
}));

const lineupPlayers: SquadPlayer[] = Array.from({ length: 11 }, (_, i) => ({
  id: `p${i}`,
  displayName: `Jugador ${i}`,
  alias: null,
  photoSrc: null,
  dorsal: i + 1,
  position: i === 0 ? "portero" : "defensa",
  competitiveness: 7,
}));

describe("PartidoEnDirectoTab - threading unlimitedWindows into SubstitutionWindowTracker", () => {
  it("passes unlimitedWindows=true through to SubstitutionWindowTracker for friendly matches", async () => {
    useLiveMatchMock.mockReturnValue(baseLiveReturn(true));

    render(
      <PartidoEnDirectoTab
        teamId="team-1"
        eventId="event-1"
        lineupPlayers={lineupPlayers}
        localTeamName="Local FC"
        visitorTeamName="Visitor FC"
        isHomeTeam
        isFriendly
      />,
    );

    expect(await screen.findByTestId("substitution-window-tracker")).toHaveAttribute(
      "data-unlimited",
      "true",
    );
  });

  it("passes unlimitedWindows=false through to SubstitutionWindowTracker for official matches", async () => {
    useLiveMatchMock.mockReturnValue(baseLiveReturn(false));

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

    expect(await screen.findByTestId("substitution-window-tracker")).toHaveAttribute(
      "data-unlimited",
      "false",
    );
  });
});
