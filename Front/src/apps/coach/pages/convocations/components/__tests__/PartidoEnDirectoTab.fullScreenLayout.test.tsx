import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PartidoEnDirectoTab from "../PartidoEnDirectoTab";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";

// Pantalla completa de partido en directo (tablet): los listados "En el campo"
// y "Banquillo" se abren bajo demanda en un popup, y los controles de gol,
// tarjeta y esquema ocupan su sitio desde antes de empezar el partido para que
// nada se desplace al pulsar "Empezar".

vi.mock("../../../../services/teamService", () => ({
  getTeamById: vi.fn().mockResolvedValue(null),
}));

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
    slots: [{ slotIndex: 0, teamPlayerId: "p0" }],
  }),
}));

vi.mock("../../../../services/liveMatchService", () => ({
  saveMatchParticipation: vi.fn().mockResolvedValue(undefined),
  getMatchParticipation: vi.fn().mockResolvedValue(null),
  deleteMatchParticipation: vi.fn().mockResolvedValue(undefined),
}));

const initMatch = vi.fn();
const changeFormation = vi.fn();

function baseLiveMatch(overrides: Record<string, unknown> = {}) {
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
    initMatch,
    confirmAction: vi.fn(),
    cancelAction: vi.fn(),
    addGoal: vi.fn(),
    removeGoal: vi.fn(),
    addCard: vi.fn(),
    removeCard: vi.fn(),
    changeFormation,
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
    ...overrides,
  };
}

let liveMatchMock = baseLiveMatch();

vi.mock("../../hooks/useLiveMatch", () => ({
  useLiveMatch: vi.fn(() => liveMatchMock),
}));

const lineupPlayers: SquadPlayer[] = [
  { id: "p0", displayName: "TitularCampo Cero", alias: null, photoSrc: null, dorsal: 1, position: "portero", competitiveness: 7 },
  { id: "p1", displayName: "BanquilloRico Uno", alias: null, photoSrc: null, dorsal: 2, position: "defensa", competitiveness: 6 },
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

describe("PartidoEnDirectoTab - listados de jugadores en popup bajo demanda", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    liveMatchMock = baseLiveMatch();
  });

  it("no muestra los listados 'En el campo' y 'Banquillo' hasta que se piden", async () => {
    renderTab();
    await screen.findByRole("button", { name: /jugadores/i });

    expect(screen.queryByText("En el campo")).not.toBeInTheDocument();
  });

  it("al pulsar 'Jugadores' abre un popup con los listados 'En el campo' y 'Banquillo'", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByRole("button", { name: /jugadores/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("En el campo")).toBeInTheDocument();
    expect(within(dialog).getByText("TitularCampo Cero")).toBeInTheDocument();
    expect(within(dialog).getByText("BanquilloRico Uno")).toBeInTheDocument();
  });

  it("agrupa cada posición con sus jugadores en un bloque propio, para que la etiqueta no se separe de sus tarjetas", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByRole("button", { name: /jugadores/i }));

    const dialog = await screen.findByRole("dialog");
    const porteros = within(dialog).getByRole("group", { name: /porteros/i });
    const defensas = within(dialog).getByRole("group", { name: /defensas/i });
    expect(within(porteros).getByText("TitularCampo Cero")).toBeInTheDocument();
    expect(within(defensas).getByText("BanquilloRico Uno")).toBeInTheDocument();
    expect(within(defensas).queryByText("TitularCampo Cero")).not.toBeInTheDocument();
  });
});

describe("PartidoEnDirectoTab - controles visibles antes de empezar el partido", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    liveMatchMock = baseLiveMatch({ matchPhase: "preMatch", currentMinute: 0 });
  });

  it("muestra el selector de esquema antes de empezar", async () => {
    renderTab();

    expect(await screen.findByRole("combobox", { name: /esquema/i })).toBeInTheDocument();
  });

  it("muestra los botones de gol y tarjeta desactivados antes de empezar", async () => {
    renderTab();
    await screen.findByRole("combobox", { name: /esquema/i });

    expect(screen.getByRole("button", { name: /^gol$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /tarjeta/i })).toBeDisabled();
  });

  it("cambiar el esquema antes de empezar reinicia la alineación inicial sin pedir confirmación", async () => {
    const user = userEvent.setup();
    renderTab();
    await waitFor(() => expect(initMatch).toHaveBeenCalledTimes(1));

    await user.click(await screen.findByRole("combobox", { name: /esquema/i }));
    await user.click(await screen.findByRole("option", { name: "4-3-3" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(changeFormation).not.toHaveBeenCalled();
    expect(initMatch).toHaveBeenCalledTimes(2);
    expect(Object.values(initMatch.mock.calls[1][0])).toContain("p0");
    expect(screen.getByRole("combobox", { name: /esquema/i })).toHaveTextContent("4-3-3");
  });
});

describe("PartidoEnDirectoTab - esquema al terminar el partido", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    liveMatchMock = baseLiveMatch({ matchPhase: "finished" });
  });

  it("desactiva el selector de esquema cuando el partido ha terminado", async () => {
    renderTab();

    const select = await screen.findByRole("combobox", { name: /esquema/i });
    expect(select).toHaveAttribute("aria-disabled", "true");
  });
});
