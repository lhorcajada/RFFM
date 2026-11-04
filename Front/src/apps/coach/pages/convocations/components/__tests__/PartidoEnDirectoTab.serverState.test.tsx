import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PartidoEnDirectoTab from "../PartidoEnDirectoTab";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";

const useLiveMatchMock = vi.fn();

vi.mock("../../../../services/teamService", () => ({
  getTeamById: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../../services/formationService", () => ({
  getFormations: vi.fn().mockResolvedValue([{ id: "f1", name: "4-4-2" }]),
}));

vi.mock("../../../../services/idealLineupService", () => ({
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

vi.mock("../../hooks/useLiveMatch", () => ({
  useLiveMatch: (...args: unknown[]) => useLiveMatchMock(...args),
}));

function liveReturn(overrides: Record<string, unknown> = {}) {
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
    playerMinutes: {},
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
    currentFormation: { id: "f1", name: "4-4-2" },
    unlimitedWindows: false,
    ratingSnapshots: [],
    pendingAction: null,
    setPendingAction: vi.fn(),
    isSaving: false,
    saveError: null,
    retrySave: vi.fn(),
    dismissSaveError: vi.fn(),
    hasSavedData: false,
    savedParticipationData: null,
    isDeleting: false,
    deleteParticipation: vi.fn(),
    matchDurationMinutes: 60,
    setMatchDuration: vi.fn(),
    isOnline: true,
    serverVersion: null,
    initMatch: vi.fn(),
    confirmAction: vi.fn(),
    cancelAction: vi.fn(),
    adjustClock: vi.fn(),
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
    ...overrides,
  };
}

const lineupPlayers: SquadPlayer[] = [];

function renderTab() {
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
}

describe("PartidoEnDirectoTab - estado en el servidor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no muestra el diálogo de recuperación aunque el hook reciba una copia local heredada", async () => {
    useLiveMatchMock.mockReturnValue(
      liveReturn({
        initialized: false,
        matchPhase: "preMatch",
        backup: {
          eventId: "event-1",
          teamId: "team-1",
          savedAt: new Date("2026-11-01T10:00:00Z").toISOString(),
          matchPhase: "firstHalf",
        },
        acceptBackup: vi.fn(),
        discardBackup: vi.fn(),
      }),
    );

    renderTab();

    expect(await screen.findByText(/guarda primero la alineación/i)).toBeInTheDocument();
    expect(screen.queryByText(/partido en progreso encontrado/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /recuperar/i })).not.toBeInTheDocument();
  });

  it("muestra un aviso de sin conexión cuando el hook informa de que el servidor no está conectado", async () => {
    useLiveMatchMock.mockReturnValue(liveReturn({ isOnline: false }));

    renderTab();

    expect(await screen.findByText(/sin conexión/i)).toBeInTheDocument();
  });

  it("un partido finalizado y guardado muestra la confirmación sin botón de guardado manual", async () => {
    useLiveMatchMock.mockReturnValue(
      liveReturn({
        matchPhase: "finished",
        hasSavedData: true,
        savedParticipationData: {
          teamId: "team-1",
          scoreLocal: 1,
          scoreVisitor: 0,
          matchPhase: "finished",
          players: [],
        },
      }),
    );

    renderTab();

    expect(await screen.findByText(/partido guardado/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /guardar datos del partido/i })).not.toBeInTheDocument();
  });

  it("un error al cerrar el partido muestra el error con el botón Reintentar", async () => {
    useLiveMatchMock.mockReturnValue(liveReturn({ matchPhase: "finished", saveError: "Error de red" }));

    renderTab();

    expect(await screen.findByText("Error de red")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });
});
