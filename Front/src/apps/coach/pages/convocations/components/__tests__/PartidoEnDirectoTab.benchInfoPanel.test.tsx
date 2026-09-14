import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import PartidoEnDirectoTab from "../PartidoEnDirectoTab";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";

// New read-only "Banquillo" info panel (rich BenchPlayerCard), always visible
// alongside the existing "En el campo" info panel — sibling of the compact,
// draggable side panel. See SimulacionTab.benchInfoPanel.test.tsx.

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
    ...overrides,
  };
}

let liveMatchMock = baseLiveMatch();

vi.mock("../../hooks/useLiveMatch", () => ({
  useLiveMatch: vi.fn(() => liveMatchMock),
}));

const lineupPlayers: SquadPlayer[] = [
  { id: "p0", displayName: "TitularCampo Cero", alias: null, photoSrc: null, dorsal: 1, position: "portero", competitiveness: 7 },
  { id: "p1", displayName: "BanquilloRico Uno", alias: null, photoSrc: null, dorsal: 2, position: "defensa", competitiveness: 6, streakCount: 2 },
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

describe("PartidoEnDirectoTab - listado informativo 'Banquillo' (tarjeta rica, solo lectura, siempre visible)", () => {
  beforeEach(() => {
    liveMatchMock = baseLiveMatch();
  });

  it("muestra los jugadores del banquillo con información completa, en un panel informativo dedicado (.benchInfoPanel), no arrastrable", async () => {
    const { container } = renderTab();
    await waitFor(() => expect(screen.getByRole("combobox", { name: /esquema/i })).toBeInTheDocument());

    const infoPanel = await waitFor(() => {
      const el = container.querySelector("[class*='benchInfoPanel']");
      if (!el) throw new Error("not yet rendered");
      return el;
    });

    const card = within(infoPanel as HTMLElement).getByText("BanquilloRico Uno");
    expect(card).toBeInTheDocument();
    expect(card.closest("[class*='dragHandle']")).toBeNull();
    expect(card.closest("[class*='benchDragHandle']")).toBeNull();
  });

  it("el bloque informativo se muestra aunque no se esté en prepareMode (siempre visible)", async () => {
    renderTab();
    await waitFor(() => expect(screen.getByRole("combobox", { name: /esquema/i })).toBeInTheDocument());

    expect(await screen.findByText("En el campo")).toBeInTheDocument();
  });
});
