import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import PartidoEnDirectoTab from "../PartidoEnDirectoTab";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";
import type { LiveMatchParticipationPayload } from "../simulation/liveMatch.types";

vi.mock("@dnd-kit/core", async () => {
  const actual = await vi.importActual<typeof import("@dnd-kit/core")>("@dnd-kit/core");
  return {
    ...actual,
    DndContext: ({ children }: any) => children,
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

const updateMatchParticipationReasonMock = vi.fn();
vi.mock("../../../../services/liveMatchService", () => ({
  saveMatchParticipation: vi.fn().mockResolvedValue(undefined),
  getMatchParticipation: vi.fn().mockResolvedValue(null),
  deleteMatchParticipation: vi.fn().mockResolvedValue(undefined),
  updateMatchParticipationReason: (...args: unknown[]) => updateMatchParticipationReasonMock(...args),
}));

function baseLiveMatch(overrides: Record<string, unknown> = {}) {
  return {
    matchPhase: "finished",
    currentMinute: 90,
    currentSecond: 0,
    half: 2,
    isHalftime: false,
    halfDuration: 45,
    setHalfDuration: vi.fn(),
    slots: { 0: "p0", 1: "p1" },
    playerStates: {},
    playerMinutes: { p0: 90, p1: 45 },
    initialSlots: { 0: "p0", 1: "p1" },
    initialized: true,
    windows: [],
    prepareMode: false,
    prepareSlotsPreview: {},
    lastCommittedWindow: null,
    windowsTotal: 0,
    windowsInSecondHalf: 0,
    canOpenWindow: false,
    goals: [],
    scoreLocal: 1,
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
    updateGoal: vi.fn(),
    updateCard: vi.fn(),
    ...overrides,
  };
}

let liveMatchMock = baseLiveMatch();

vi.mock("../../hooks/useLiveMatch", () => ({
  useLiveMatch: vi.fn(() => liveMatchMock),
}));

const lineupPlayers: SquadPlayer[] = [
  { id: "p0", displayName: "Portero Uno", alias: null, photoSrc: null, dorsal: 1, position: "portero", competitiveness: 7 },
  { id: "p1", displayName: "Defensa Uno", alias: null, photoSrc: null, dorsal: 2, position: "defensa", competitiveness: 7 },
];

const savedParticipation: LiveMatchParticipationPayload = {
  teamId: "team-1",
  scoreLocal: 1,
  scoreVisitor: 0,
  matchPhase: "finished",
  players: [
    { teamPlayerId: "p0", minutesPlayed: 90, isStarter: true, enteredAtMinute: 0, exitedAtMinute: null, minutesReason: "Vuelta de vacaciones" },
    { teamPlayerId: "p1", minutesPlayed: 45, isStarter: true, enteredAtMinute: 0, exitedAtMinute: 45, minutesReason: null },
  ],
  substitutionWindowsJson: "[]",
  ratingSnapshotsJson: "[]",
  goalsJson: "[]",
  cardsJson: "[]",
  formationChangesJson: "[]",
};

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

describe("PartidoEnDirectoTab — motivo de minutos (post-partido)", () => {
  beforeEach(() => {
    updateMatchParticipationReasonMock.mockReset().mockResolvedValue(undefined);
    liveMatchMock = baseLiveMatch({ hasSavedData: true, savedParticipationData: savedParticipation });
  });

  it("no muestra el botón de motivos mientras el partido no está guardado", async () => {
    liveMatchMock = baseLiveMatch({ hasSavedData: false, savedParticipationData: null });
    renderTab();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edición manual del partido/i })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /motivos de minutos/i })).not.toBeInTheDocument();
  });

  it("muestra un único botón de motivos que indica cuántos jugadores ya tienen uno guardado", async () => {
    renderTab();

    expect(
      await screen.findByRole("button", { name: /motivos de minutos.*1 con motivo guardado/i }),
    ).toBeInTheDocument();
    // El motivo guardado no se muestra expandido fuera del diálogo.
    expect(screen.queryByText("Vuelta de vacaciones")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre un único diálogo con el listado completo al pulsar el botón", async () => {
    renderTab();

    fireEvent.click(await screen.findByRole("button", { name: /motivos de minutos/i }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Portero Uno")).toBeInTheDocument();
    expect(within(dialog).getByText("Defensa Uno")).toBeInTheDocument();
  });

  it("guarda un motivo nuevo llamando al endpoint de match-participation con el teamPlayerId correcto, sin cerrar el diálogo", async () => {
    renderTab();

    fireEvent.click(await screen.findByRole("button", { name: /motivos de minutos/i }));
    fireEvent.click(screen.getByRole("button", { name: /editar motivo de defensa uno/i }));

    fireEvent.change(screen.getByRole("textbox", { name: /motivo de defensa uno/i }), {
      target: { value: "Buen partido, listo para más minutos" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() =>
      expect(updateMatchParticipationReasonMock).toHaveBeenCalledWith(
        "event-1",
        "p1",
        "Buen partido, listo para más minutos",
      ),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("borra un motivo existente enviando null al endpoint de match-participation, sin cerrar el diálogo", async () => {
    renderTab();

    fireEvent.click(await screen.findByRole("button", { name: /motivos de minutos/i }));
    fireEvent.click(screen.getByRole("button", { name: /editar motivo de portero uno/i }));
    fireEvent.click(screen.getByRole("button", { name: /^borrar motivo$/i }));

    await waitFor(() =>
      expect(updateMatchParticipationReasonMock).toHaveBeenCalledWith("event-1", "p0", null),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
