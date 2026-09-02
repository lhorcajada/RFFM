import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import PartidoEnDirectoTab from "../PartidoEnDirectoTab";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";

const repositionPlayer = vi.fn();
const movePreparePlayer = vi.fn();
let capturedOnDragEnd: ((e: { active: { id: string }; over: { id: string } | null }) => void) | null =
  null;

vi.mock("@dnd-kit/core", async () => {
  const actual = await vi.importActual<typeof import("@dnd-kit/core")>("@dnd-kit/core");
  return {
    ...actual,
    DndContext: ({ children, onDragEnd }: any) => {
      capturedOnDragEnd = onDragEnd;
      return children;
    },
    DragOverlay: ({ children }: any) => children,
    useDraggable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: () => {},
      transform: null,
      isDragging: false,
    }),
    useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
  };
});

vi.mock("../../../../services/formationService", () => ({
  getFormations: vi.fn().mockResolvedValue([{ id: "f1", name: "4-4-2" }]),
}));

vi.mock("../../../../services/idealLineupService", () => ({
  getIdealLineup: vi.fn().mockResolvedValue({
    id: "lineup-1",
    formationId: "f1",
    slots: [
      { slotIndex: 0, teamPlayerId: "p0" },
      { slotIndex: 1, teamPlayerId: "p1" },
    ],
  }),
}));

vi.mock("../../../../services/liveMatchService", () => ({
  saveMatchParticipation: vi.fn().mockResolvedValue(undefined),
  getMatchParticipation: vi.fn().mockResolvedValue(null),
  deleteMatchParticipation: vi.fn().mockResolvedValue(undefined),
}));

function baseLiveMatch(overrides: Record<string, unknown> = {}) {
  return {
    matchPhase: "firstHalf",
    currentMinute: 10,
    currentSecond: 0,
    half: 1,
    isHalftime: false,
    halfDuration: 45,
    setHalfDuration: vi.fn(),
    slots: { 0: "p0", 1: "p1" },
    playerStates: {},
    playerMinutes: {},
    initialSlots: { 0: "p0", 1: "p1" },
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
    movePreparePlayer,
    movePreparePlayerToBench: vi.fn(),
    commitWindow: vi.fn(),
    repositionPlayer,
    dismissConfirmation: vi.fn(),
    dismissSaveError: vi.fn(),
    acceptBackup: vi.fn(),
    discardBackup: vi.fn(),
    ...overrides,
  };
}

let liveMatchMock = baseLiveMatch();

vi.mock("../../hooks/useLiveMatch", () => ({
  useLiveMatch: vi.fn(() => liveMatchMock),
}));

const lineupPlayers: SquadPlayer[] = [
  { id: "p0", displayName: "Jugador 0", alias: null, photoSrc: null, dorsal: 1, position: "portero", competitiveness: 7 },
  { id: "p1", displayName: "Jugador 1", alias: null, photoSrc: null, dorsal: 2, position: "defensa", competitiveness: 7 },
];

function renderTab() {
  return render(
    <PartidoEnDirectoTab
      teamId="team-1"
      eventId="event-1"
      lineupPlayers={lineupPlayers}
      localTeamName="Local FC"
      visitorTeamName="Visitor FC"
      isHomeTeam
    />,
  );
}

describe("PartidoEnDirectoTab - free field repositioning (no prepare needed)", () => {
  beforeEach(() => {
    repositionPlayer.mockClear();
    movePreparePlayer.mockClear();
    capturedOnDragEnd = null;
    liveMatchMock = baseLiveMatch();
  });

  it("dragging an on-field player onto another field slot calls live.repositionPlayer, outside prepareMode", async () => {
    renderTab();
    await waitFor(() => expect(screen.getByRole("combobox", { name: /esquema/i })).toBeInTheDocument());

    expect(capturedOnDragEnd).toBeTruthy();
    capturedOnDragEnd!({ active: { id: "sim-player-p0" }, over: { id: "sim-slot-1" } });

    expect(repositionPlayer).toHaveBeenCalledWith(0, 1);
    expect(movePreparePlayer).not.toHaveBeenCalled();
  });

  it("dropping an on-field player onto the bench outside prepareMode does nothing", async () => {
    renderTab();
    await waitFor(() => expect(screen.getByRole("combobox", { name: /esquema/i })).toBeInTheDocument());

    capturedOnDragEnd!({ active: { id: "sim-player-p0" }, over: { id: "sim-bench" } });

    expect(repositionPlayer).not.toHaveBeenCalled();
  });

  it("while prepareMode is true, dragging goes through movePreparePlayer instead of repositionPlayer", async () => {
    liveMatchMock = baseLiveMatch({ prepareMode: true, prepareSlotsPreview: { 0: "p0", 1: "p1" } });
    renderTab();
    await waitFor(() => expect(screen.getByRole("combobox", { name: /esquema/i })).toBeInTheDocument());

    capturedOnDragEnd!({ active: { id: "sim-player-p0" }, over: { id: "sim-slot-1" } });

    expect(movePreparePlayer).toHaveBeenCalledWith("p0", 0, 1);
    expect(repositionPlayer).not.toHaveBeenCalled();
  });
});
