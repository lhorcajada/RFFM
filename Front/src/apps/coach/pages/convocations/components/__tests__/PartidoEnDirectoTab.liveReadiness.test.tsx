import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PartidoEnDirectoTab from "../PartidoEnDirectoTab";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";

const useLiveMatchMock = vi.fn();

vi.mock("../../../../services/formationService", () => ({
  getFormations: vi.fn().mockResolvedValue([{ id: "f1", name: "4-4-2" }]),
}));

vi.mock("../../../../services/idealLineupService", () => ({
  // Only 1 slot filled — the rest of lineupPlayers end up on the bench.
  getIdealLineup: vi.fn().mockResolvedValue({
    id: "lineup-1",
    formationId: "f1",
    slots: [{ slotIndex: 0, teamPlayerId: "p0" }],
  }),
}));

vi.mock("../../../../services/liveMatchService", () => ({
  saveMatchParticipation: vi.fn().mockResolvedValue(undefined),
  getMatchParticipation: vi.fn().mockResolvedValue(null),
  deleteMatchParticipation: vi.fn().mockResolvedValue(undefined),
}));

function baseLiveReturn(playerMinutes: Record<string, number>) {
  return {
    matchPhase: "firstHalf",
    currentMinute: 10,
    currentSecond: 0,
    half: 1,
    isHalftime: false,
    halfDuration: 45,
    setHalfDuration: vi.fn(),
    slots: { 0: "p0" },
    playerStates: {},
    playerMinutes,
    initialSlots: { 0: "p0" },
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

vi.mock("../../hooks/useLiveMatch", () => ({
  useLiveMatch: (...args: unknown[]) => useLiveMatchMock(...args),
}));

// trainingComponent 80, matchMinutesInWindow 0 de 560 esperados -> readiness original = round(0.7*80) = 56
const lineupPlayers: SquadPlayer[] = [
  { id: "p0", displayName: "Titular", dorsal: 1, position: "portero", competitiveness: 7 },
  {
    id: "p1",
    displayName: "Suplente Uno",
    dorsal: 12,
    position: "defensa",
    competitiveness: 6,
    readiness: 56,
    readinessBreakdown: {
      trainingComponent: 80,
      matchMinutesInWindow: 0,
      matchMinutesExpected: 560,
    },
  },
];

describe("PartidoEnDirectoTab - rodaje en vivo", () => {
  it("sube el % de rodaje mostrado en la tarjeta del banquillo al acumular minutos en el partido en directo", async () => {
    useLiveMatchMock.mockReturnValue(baseLiveReturn({ p1: 140 }));

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

    // matchComponent = 140/560*100 = 25; readiness = round(0.7*80 + 0.3*25) = round(56 + 7.5) = 64
    expect(await screen.findByText("64%")).toBeInTheDocument();
    expect(screen.queryByText("56%")).not.toBeInTheDocument();
  });

  it("con 0 minutos en el partido en directo, muestra el mismo % que el rodaje original", async () => {
    useLiveMatchMock.mockReturnValue(baseLiveReturn({}));

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

    expect(await screen.findByText("56%")).toBeInTheDocument();
  });
});
