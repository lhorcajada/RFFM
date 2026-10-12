import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import PartidoEnDirectoTab from "../PartidoEnDirectoTab";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";

// ─────────────────────────────────────────────────────────────────────────────
// Regression: in "preparar cambio", sending a field player (e.g. the
// goalkeeper) to the bench leaves their slot empty. A bench player dropped on
// that empty slot used to be silently ignored, so the slot could never be
// filled again for the rest of the match.
// ─────────────────────────────────────────────────────────────────────────────

const movePreparePlayer = vi.fn();
let capturedOnDragEnd: ((e: { active: { id: string }; over: { id: string } | null }) => void) | null =
  null;

vi.mock("../../../../services/teamService", () => ({
  getTeamById: vi.fn().mockResolvedValue(null),
}));

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
    prepareMode: true,
    prepareSlotsPreview: { 0: null, 1: "p1" },
    lastCommittedWindow: null,
    windowsTotal: 0,
    windowsInSecondHalf: 0,
    canOpenWindow: true,
    goals: [],
    scoreLocal: 0,
    scoreVisitor: 0,
    cards: [],
    formationChanges: [],
    currentFormation: { id: "f1", name: "4-4-2" },
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
    repositionPlayer: vi.fn(),
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
  { id: "p0", displayName: "Portero Titular", alias: null, photoSrc: null, dorsal: 1, position: "portero", competitiveness: 7 },
  { id: "p1", displayName: "Jugador 1", alias: null, photoSrc: null, dorsal: 2, position: "defensa", competitiveness: 7 },
  { id: "p2", displayName: "Portero Suplente", alias: null, photoSrc: null, dorsal: 13, position: "portero", competitiveness: 6 },
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

describe("PartidoEnDirectoTab - soltar un suplente en una casilla vacía (preparar cambio)", () => {
  beforeEach(() => {
    movePreparePlayer.mockClear();
    capturedOnDragEnd = null;
    liveMatchMock = baseLiveMatch();
  });

  it("coloca al jugador del banquillo en la casilla que quedó vacía", async () => {
    renderTab();
    await waitFor(() => expect(screen.getByRole("combobox", { name: /esquema/i })).toBeInTheDocument());

    capturedOnDragEnd!({ active: { id: "sim-player-p2" }, over: { id: "sim-slot-0" } });

    expect(movePreparePlayer).toHaveBeenCalledWith("p2", null, 0);
  });
});
