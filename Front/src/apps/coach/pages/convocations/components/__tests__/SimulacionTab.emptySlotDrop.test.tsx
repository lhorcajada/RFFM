import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import SimulacionTab from "../SimulacionTab";
import type { UseMatchSimulationReturn } from "../../hooks/useMatchSimulation";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";

// ─────────────────────────────────────────────────────────────────────────────
// Regression: in "preparar cambio", sending a field player to the bench leaves
// their slot empty. A bench player dropped on that empty slot used to be
// silently ignored, so the slot could never be filled again.
// ─────────────────────────────────────────────────────────────────────────────

const useMatchSimulationMock = vi.fn();
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
    slots: { 0: "p0", 1: "p1" },
    playerStates: {},
    playerMinutes: {},
    windows: [],
    prepareMode: true,
    prepareSlotsPreview: { 0: null, 1: "p1" },
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
    movePreparePlayer,
    movePreparePlayerToBench: vi.fn(),
    commitWindow: vi.fn(),
    dismissConfirmation: vi.fn(),
    toMatchSimulation: vi.fn(),
    ...overrides,
  };
}

const lineupPlayers: SquadPlayer[] = [
  { id: "p0", displayName: "Portero Titular", dorsal: 1, position: "Portero", competitiveness: 7 },
  { id: "p1", displayName: "Jugador Uno", dorsal: 2, position: "Defensa", competitiveness: 7 },
  { id: "p2", displayName: "Portero Suplente", dorsal: 13, position: "Portero", competitiveness: 6 },
];

describe("SimulacionTab - soltar un suplente en una casilla vacía (preparar cambio)", () => {
  beforeEach(() => {
    movePreparePlayer.mockClear();
    capturedOnDragEnd = null;
  });

  it("coloca al jugador del banquillo en la casilla que quedó vacía", async () => {
    useMatchSimulationMock.mockReturnValue(baseSimReturn());

    render(<SimulacionTab teamId="team-1" eventId="event-1" lineupPlayers={lineupPlayers} />);
    await screen.findByText("Disponibles para el cambio");

    capturedOnDragEnd!({ active: { id: "sim-player-p2" }, over: { id: "sim-slot-0" } });

    expect(movePreparePlayer).toHaveBeenCalledWith("p2", null, 0);
  });
});
