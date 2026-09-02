import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PartidoEnDirectoTab from "../PartidoEnDirectoTab";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";

const changeFormation = vi.fn();

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
    slots: Array.from({ length: 11 }, (_, i) => ({ slotIndex: i, teamPlayerId: `p${i}` })),
  }),
}));

vi.mock("../../../../services/liveMatchService", () => ({
  saveMatchParticipation: vi.fn().mockResolvedValue(undefined),
  getMatchParticipation: vi.fn().mockResolvedValue(null),
  deleteMatchParticipation: vi.fn().mockResolvedValue(undefined),
}));

function buildSlots() {
  const slots: Record<number, string | null> = {};
  for (let i = 0; i < 11; i++) slots[i] = `p${i}`;
  return slots;
}

vi.mock("../../hooks/useLiveMatch", () => ({
  useLiveMatch: vi.fn(() => ({
    matchPhase: "firstHalf",
    currentMinute: 10,
    currentSecond: 0,
    half: 1,
    isHalftime: false,
    halfDuration: 45,
    setHalfDuration: vi.fn(),
    slots: buildSlots(),
    playerStates: {},
    playerMinutes: {},
    initialSlots: buildSlots(),
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
  })),
}));

const lineupPlayers: SquadPlayer[] = Array.from({ length: 11 }, (_, i) => ({
  id: `p${i}`,
  displayName: `Jugador ${i}`,
  alias: null,
  photoSrc: null,
  dorsal: i + 1,
  position: i === 0 ? "portero" : "defensa",
  competitiveness: 7,
}));

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

describe("PartidoEnDirectoTab - mid-match formation change UI", () => {
  beforeEach(() => {
    changeFormation.mockClear();
  });

  it("opens a confirmation dialog when the formation selector changes during firstHalf", async () => {
    renderTab();
    await waitFor(() => expect(screen.getByRole("combobox", { name: /esquema/i })).toBeInTheDocument());

    await userEvent.click(screen.getByRole("combobox", { name: /esquema/i }));
    await userEvent.click(await screen.findByRole("option", { name: "4-3-3" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(changeFormation).not.toHaveBeenCalled();
  });

  it("confirming calls live.changeFormation with the new formation id/name/slots", async () => {
    renderTab();
    await waitFor(() => expect(screen.getByRole("combobox", { name: /esquema/i })).toBeInTheDocument());

    await userEvent.click(screen.getByRole("combobox", { name: /esquema/i }));
    await userEvent.click(await screen.findByRole("option", { name: "4-3-3" }));

    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    expect(changeFormation).toHaveBeenCalledTimes(1);
    const [calledId, calledName, calledSlots] = changeFormation.mock.calls[0];
    expect(calledId).toBe("f2");
    expect(calledName).toBe("4-3-3");
    expect(calledSlots).toBeTruthy();
  });

  it("canceling leaves the current formation untouched", async () => {
    renderTab();
    await waitFor(() => expect(screen.getByRole("combobox", { name: /esquema/i })).toBeInTheDocument());

    await userEvent.click(screen.getByRole("combobox", { name: /esquema/i }));
    await userEvent.click(await screen.findByRole("option", { name: "4-3-3" }));
    await screen.findByRole("dialog", { name: /4-3-3/i });

    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    expect(changeFormation).not.toHaveBeenCalled();
    expect(await screen.findByRole("combobox", { name: /esquema/i })).toHaveTextContent("4-4-2");
  });
});
