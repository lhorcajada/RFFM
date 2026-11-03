import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PartidoEnDirectoTab from "../PartidoEnDirectoTab";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";
import type { LiveMatchBackup } from "../simulation/liveMatch.types";

const useLiveMatchMock = vi.fn();
const getIdealLineupMock = vi.fn();

vi.mock("../../../../services/teamService", () => ({
  getTeamById: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../../services/formationService", () => ({
  getFormations: vi.fn().mockResolvedValue([{ id: "f1", name: "4-4-2" }]),
}));

vi.mock("../../../../services/idealLineupService", () => ({
  getIdealLineup: (...args: unknown[]) => getIdealLineupMock(...args),
}));

vi.mock("../../../../services/liveMatchService", () => ({
  saveMatchParticipation: vi.fn().mockResolvedValue(undefined),
  getMatchParticipation: vi.fn().mockResolvedValue(null),
  deleteMatchParticipation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../hooks/useLiveMatch", () => ({
  useLiveMatch: (...args: unknown[]) => useLiveMatchMock(...args),
}));

const backup = {
  eventId: "event-1",
  teamId: "team-1",
  savedAt: new Date("2026-11-01T10:00:00Z").toISOString(),
  matchPhase: "firstHalf",
} as LiveMatchBackup;

function notInitializedLive() {
  return {
    matchPhase: "preMatch",
    initialized: false,
    currentFormation: null,
    slots: {},
    playerStates: {},
    playerMinutes: {},
    initialSlots: {},
    windows: [],
    goals: [],
    cards: [],
    formationChanges: [],
    ratingSnapshots: [],
    prepareMode: false,
    prepareSlotsPreview: {},
    backup,
    initMatch: vi.fn(),
    setHalfDuration: vi.fn(),
    acceptBackup: vi.fn(),
    discardBackup: vi.fn(),
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

describe("PartidoEnDirectoTab - recuperación de copia de seguridad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLiveMatchMock.mockReturnValue(notInitializedLive());
  });

  it("ofrece recuperar el partido aunque la alineación no esté cargada", async () => {
    getIdealLineupMock.mockResolvedValue(null);

    renderTab();

    expect(await screen.findByText(/partido en progreso encontrado/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /recuperar/i })).toBeInTheDocument();
  });

  it("ofrece recuperar el partido aunque falle la carga de datos", async () => {
    getIdealLineupMock.mockRejectedValue(new Error("network"));

    renderTab();

    expect(await screen.findByText(/partido en progreso encontrado/i)).toBeInTheDocument();
  });
});
