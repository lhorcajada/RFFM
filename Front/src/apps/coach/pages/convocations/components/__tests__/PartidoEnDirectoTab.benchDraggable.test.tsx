import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import PartidoEnDirectoTab from "../PartidoEnDirectoTab";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";

// See SimulacionTab.benchDraggable.test.tsx for the full rationale: this
// proves the React render tree for the compact, draggable side-panel bench
// cards is intact in PartidoEnDirectoTab too (shared CompactBenchCard module
// and SimulacionTab.module.css layout, applied here via `simStyles`). The
// player's name can legitimately appear twice on the page — once compact
// (draggable, side panel) and once rich (read-only, info panel below) — so
// queries are scoped to the side panel to avoid ambiguity.

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
    prepareMode: true,
    prepareSlotsPreview: { 0: "p0" },
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
  { id: "p0", displayName: "Titular Cero", alias: null, photoSrc: null, dorsal: 1, position: "portero", competitiveness: 7 },
  { id: "p1", displayName: "BanquilloDraggable Uno", alias: null, photoSrc: null, dorsal: 2, position: "defensa", competitiveness: 7 },
];

describe("PartidoEnDirectoTab - el banquillo arrastrable (prepareMode) sigue en el DOM", () => {
  beforeEach(() => {
    liveMatchMock = baseLiveMatch();
  });

  it("en prepareMode, el jugador de banquillo se renderiza dentro de la zona droppable (draggable)", async () => {
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

    await waitFor(() => expect(screen.getByRole("combobox", { name: /esquema/i })).toBeInTheDocument());

    const heading = screen.getByText("Disponibles para el cambio");
    const sidePanel = heading.closest("div")!.parentElement as HTMLElement;

    const card = within(sidePanel).getByText("BanquilloDraggable Uno");
    expect(card).toBeInTheDocument();
    expect(card.closest("[class*='dragHandle']")).not.toBeNull();
  });
});
