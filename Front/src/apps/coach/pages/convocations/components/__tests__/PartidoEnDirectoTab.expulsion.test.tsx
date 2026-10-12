import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import PartidoEnDirectoTab from "../PartidoEnDirectoTab";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";
import type { CardEvent } from "../simulation/liveMatch.types";
import { saveMatchParticipation } from "../../../../services/liveMatchService";

const movePreparePlayer = vi.fn();
const confirmMinPlayersEnd = vi.fn();
const cancelMinPlayersEnd = vi.fn();
const retrySave = vi.fn();
const setScore = vi.fn();
const setMatchDuration = vi.fn();
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
  getFormations: vi.fn().mockResolvedValue([
    { id: "f1", name: "4-4-2" },
    { id: "f2", name: "4-3-3" },
  ]),
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
  updateMatchParticipationReason: vi.fn().mockResolvedValue(undefined),
}));

function ownCard(teamPlayerId: string, cardType: "yellow" | "red", id: string): CardEvent {
  return { id, minute: 10, half: 1, cardType, teamPlayerId, playerName: teamPlayerId, isRivalPlayer: false, rivalDorsal: null };
}

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
    setScore,
    cards: [],
    formationChanges: [],
    currentFormation: { id: "f1", name: "4-4-2" },
    pendingMinPlayersCard: null,
    confirmMinPlayersEnd,
    cancelMinPlayersEnd,
    unlimitedWindows: false,
    ratingSnapshots: [],
    pendingAction: null,
    setPendingAction: vi.fn(),
    isSaving: false,
    saveError: null,
    retrySave,
    hasSavedData: false,
    savedParticipationData: null,
    matchDurationMinutes: null,
    setMatchDuration,
    isDeleting: false,
    deleteParticipation: vi.fn(),
    backup: null,
    initMatch: vi.fn(),
    confirmAction: vi.fn(),
    cancelAction: vi.fn(),
    addGoal: vi.fn(),
    removeGoal: vi.fn(),
    updateGoal: vi.fn(),
    addCard: vi.fn(),
    removeCard: vi.fn(),
    updateCard: vi.fn(),
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
  { id: "p1", displayName: "Defensa Expulsado", alias: null, photoSrc: null, dorsal: 2, position: "defensa", competitiveness: 7 },
  { id: "p2", displayName: "Suplente Disponible", alias: null, photoSrc: null, dorsal: 13, position: "defensa", competitiveness: 6 },
];

/** p1 sent off with a direct red: 10-player formation, p1 on the bench */
function afterRedCard(overrides: Record<string, unknown> = {}) {
  return baseLiveMatch({
    slots: { 0: "p0" },
    cards: [ownCard("p1", "red", "c1")],
    currentFormation: { id: "reduced:4-4-1", name: "4-4-1" },
    ...overrides,
  });
}

async function renderTab() {
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
  // By text: an open confirmation dialog hides the rest of the page from role queries
  await waitFor(() => expect(screen.getByText(/^Banquillo|^Disponibles para el cambio/)).toBeInTheDocument());
}

function formationOptions(): string[] {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: /esquema/i }));
  return screen.getAllByRole("option").map((o) => o.textContent ?? "");
}

describe("PartidoEnDirectoTab - tarjetas en la foto del jugador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnDragEnd = null;
  });

  it("muestra la amarilla en la foto de un jugador amonestado que sigue en el campo", async () => {
    liveMatchMock = baseLiveMatch({ cards: [ownCard("p1", "yellow", "c1")] });

    await renderTab();

    expect(screen.getByRole("img", { name: "Tarjeta amarilla" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Tarjeta roja" })).not.toBeInTheDocument();
  });

  it("muestra la roja en la foto del expulsado, en el banquillo", async () => {
    liveMatchMock = afterRedCard();

    await renderTab();

    const benchCard = screen.getByTitle("Defensa Expulsado");
    expect(within(benchCard).getByRole("img", { name: "Tarjeta roja" })).toBeInTheDocument();
  });

  it("muestra amarilla y roja en la foto del expulsado por doble amarilla", async () => {
    liveMatchMock = afterRedCard({ cards: [ownCard("p1", "yellow", "c1"), ownCard("p1", "yellow", "c2")] });

    await renderTab();

    const benchCard = screen.getByTitle("Defensa Expulsado");
    expect(within(benchCard).getByRole("img", { name: "Tarjeta amarilla" })).toBeInTheDocument();
    expect(within(benchCard).getByRole("img", { name: "Tarjeta roja" })).toBeInTheDocument();
  });
});

describe("PartidoEnDirectoTab - un expulsado no vuelve al campo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnDragEnd = null;
  });

  it("en preparar cambio el expulsado sigue en el banquillo pero no es arrastrable", async () => {
    liveMatchMock = afterRedCard({ prepareMode: true, prepareSlotsPreview: { 0: "p0" } });

    await renderTab();

    expect(screen.getByTitle("Defensa Expulsado").closest("[class*='dragHandle']")).toBeNull();
    expect(screen.getByTitle("Suplente Disponible").closest("[class*='dragHandle']")).not.toBeNull();
  });

  it("soltar al expulsado sobre una casilla no lo mete en el campo", async () => {
    liveMatchMock = afterRedCard({ prepareMode: true, prepareSlotsPreview: { 0: "p0" } });
    await renderTab();

    capturedOnDragEnd!({ active: { id: "sim-player-p1" }, over: { id: "sim-slot-1" } });

    expect(movePreparePlayer).not.toHaveBeenCalled();
  });
});

describe("PartidoEnDirectoTab - esquemas según los jugadores permitidos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("con 11 jugadores ofrece los esquemas de 11", async () => {
    liveMatchMock = baseLiveMatch();
    await renderTab();

    expect(formationOptions()).toEqual(["4-4-2", "4-3-3"]);
  });

  it("tras una expulsión ofrece solo esquemas de 10 jugadores", async () => {
    liveMatchMock = afterRedCard();
    await renderTab();

    const options = formationOptions();

    expect(options).toContain("4-4-1");
    expect(options).toContain("3-4-2");
    expect(options).not.toContain("4-4-2");
  });

  it("pinta el campo con las casillas del esquema reducido en uso", async () => {
    liveMatchMock = afterRedCard();

    await renderTab();

    expect(screen.getAllByText("DF")).toHaveLength(4);
    expect(screen.getAllByText("DC")).toHaveLength(1);
  });

  it("al quitar la tarjeta vuelve a ofrecer los esquemas de 11 junto al esquema en uso", async () => {
    liveMatchMock = afterRedCard({ cards: [] });
    await renderTab();

    expect(formationOptions()).toEqual(["4-4-1", "4-4-2", "4-3-3"]);
  });
});

describe("PartidoEnDirectoTab - menos de 7 jugadores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pide confirmación para finalizar el partido y la confirma", async () => {
    liveMatchMock = baseLiveMatch({ pendingMinPlayersCard: ownCard("p1", "red", "c1") });
    await renderTab();

    fireEvent.click(screen.getByRole("button", { name: "Finalizar partido" }));

    expect(screen.getByText("El equipo se queda con menos de 7 jugadores")).toBeInTheDocument();
    expect(confirmMinPlayersEnd).toHaveBeenCalledTimes(1);
  });

  it("al cancelar no finaliza el partido", async () => {
    liveMatchMock = baseLiveMatch({ pendingMinPlayersCard: ownCard("p1", "red", "c1") });
    await renderTab();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(cancelMinPlayersEnd).toHaveBeenCalledTimes(1);
    expect(confirmMinPlayersEnd).not.toHaveBeenCalled();
  });

  it("no muestra la confirmación si no hay expulsión pendiente", async () => {
    liveMatchMock = baseLiveMatch();

    await renderTab();

    expect(screen.queryByText("El equipo se queda con menos de 7 jugadores")).not.toBeInTheDocument();
  });
});

describe("PartidoEnDirectoTab - guardado automático", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("con el partido terminado no hay botón de guardar", async () => {
    liveMatchMock = baseLiveMatch({ matchPhase: "finished" });

    await renderTab();

    expect(screen.queryByRole("button", { name: /guardar datos del partido/i })).not.toBeInTheDocument();
  });

  it("si el guardado falla permite reintentarlo", async () => {
    liveMatchMock = baseLiveMatch({ matchPhase: "finished", saveError: "Error al guardar los datos del partido. Inténtalo de nuevo." });
    await renderTab();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(retrySave).toHaveBeenCalledTimes(1);
  });

  it("la edición manual guarda el resultado y la duración corregidos", async () => {
    liveMatchMock = baseLiveMatch({ matchPhase: "finished", hasSavedData: true, scoreLocal: 1, matchDurationMinutes: 83 });
    await renderTab();
    fireEvent.click(screen.getByRole("button", { name: /edición manual del partido/i }));

    fireEvent.change(await screen.findByLabelText(/duración del partido/i), { target: { value: "70" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(saveMatchParticipation).toHaveBeenCalledWith(
        "event-1",
        expect.objectContaining({ scoreLocal: 1, matchDurationMinutes: 70 }),
      ),
    );
  });
});

describe("PartidoEnDirectoTab - botones de eventos bajo el banquillo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra los cuatro botones de gol y tarjeta", async () => {
    liveMatchMock = baseLiveMatch();

    await renderTab();

    for (const name of ["Gol a favor", "Gol en contra", "Tarjeta nuestra", "Tarjeta rival"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });
});
