import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../services/convocationService", () => ({
  default: {
    getEventPlayers: vi.fn(),
    getConvocations: vi.fn().mockResolvedValue([]),
    addConvocation: vi.fn(),
    addConvocationsBulk: vi.fn(),
    updateConvocationStatus: vi.fn(),
    deleteConvocation: vi.fn(),
  },
}));

vi.mock("../../../../../services/convocationStatusService", () => ({
  default: {
    getConvocationStatuses: vi.fn().mockResolvedValue([{ id: 2, name: "Accepted" }]),
  },
}));

vi.mock("../../../../../services/assistanceTypeService", () => ({
  default: {
    getAssistanceTypes: vi.fn().mockResolvedValue([]),
  },
}));

const getTeamConvocationsSummaryMock = vi.fn();
vi.mock("../../../../../services/attendanceSummaryService", () => ({
  default: {
    getTrainingAttendanceSummary: vi.fn().mockResolvedValue({ totalTrainingEvents: 0, players: [] }),
    getTeamConvocationsSummary: (...args: unknown[]) => getTeamConvocationsSummaryMock(...args),
  },
}));

vi.mock("../../../../../services/idealLineupService", () => ({
  getIdealLineup: vi.fn().mockResolvedValue({ id: "lineup-1", formationId: "f-1", slots: [] }),
}));

vi.mock("../../../../../services/sportEventTypeService", () => ({
  default: {
    getSportEventTypes: vi.fn().mockResolvedValue([{ id: 1, name: "Partido" }]),
  },
}));

const getSportEventsMock = vi.fn();
vi.mock("../../../../../services/sportEventService", () => ({
  default: { getSportEvents: (...args: unknown[]) => getSportEventsMock(...args) },
  getSportEvents: (...args: unknown[]) => getSportEventsMock(...args),
}));

const getPlayersByTeamMock = vi.fn();
vi.mock("../../../../../services/teamplayerService", () => ({
  default: {
    getPlayersByTeam: (...args: unknown[]) => getPlayersByTeamMock(...args),
  },
}));

const getActiveSeasonMock = vi.fn();
vi.mock("../../../../../services/seasonService", () => ({
  default: {
    getActiveSeason: (...args: unknown[]) => getActiveSeasonMock(...args),
  },
}));

const getMatchMinutesMock = vi.fn();
const getSeasonPlayerMinutesMock = vi.fn();
vi.mock("../../../../../services/liveMatchService", () => ({
  default: {
    getMatchMinutes: (...args: unknown[]) => getMatchMinutesMock(...args),
    getSeasonPlayerMinutes: (...args: unknown[]) => getSeasonPlayerMinutesMock(...args),
  },
  getMatchMinutes: (...args: unknown[]) => getMatchMinutesMock(...args),
  getSeasonPlayerMinutes: (...args: unknown[]) => getSeasonPlayerMinutesMock(...args),
}));

const excuseTypeServiceGetExcuseTypesMock = vi.fn();
vi.mock("../../../../../services/excuseTypeService", () => ({
  default: {
    getExcuseTypes: (...args: unknown[]) => excuseTypeServiceGetExcuseTypesMock(...args),
  },
}));

import AttendanceSummaryContent from "../AttendanceSummaryContent";

function makeMatchEvent(id: string, opts: { friendly?: boolean } = {}) {
  return {
    id,
    name: `Partido ${id}`,
    title: `Partido ${id}`,
    eventType: "Partido",
    eventTypeId: 1,
    startTime: "2026-01-01T10:00:00Z",
    rivalName: "Rival",
    matchCategory: opts.friendly ? "Friendly" : "League",
  };
}

// Mirrors the real backend: friendly events come back with their own event-type name
// ("Amistoso", seeded as SportEventType.Id=4) rather than reusing "Partido"/eventTypeId 1.
function makeRealisticFriendlyEvent(id: string, date = "2026-01-08T10:00:00Z") {
  return {
    id,
    name: `Amistoso ${id}`,
    title: `Amistoso ${id}`,
    eventType: "Amistoso",
    eventTypeId: 4,
    startTime: date,
    rivalName: "Rival amistoso",
    matchCategory: "Friendly",
  };
}

// Mirrors the real backend: tournaments ("Torneo", seeded as SportEventType.Id=6)
// are not counted yet — support for them is not built into the attendance summary.
function makeRealisticTournamentEvent(id: string) {
  return {
    id,
    name: `Torneo ${id}`,
    title: `Torneo ${id}`,
    eventType: "Torneo",
    eventTypeId: 6,
    startTime: "2026-01-15T10:00:00Z",
    rivalName: "Rival torneo",
    matchCategory: "Tournament",
  };
}

describe("AttendanceSummaryContent — partidos amistosos y minutos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveSeasonMock.mockResolvedValue({
      id: "active-season",
      startDate: "2026-08-01T00:00:00Z",
      endDate: "2027-06-30T23:59:59Z",
    });
    getPlayersByTeamMock.mockResolvedValue([
      { id: "tp-1", playerId: "p-1", name: "Jugador", lastName: "Uno", alias: "J1" },
    ]);
    getSportEventsMock.mockResolvedValue({
      items: [makeMatchEvent("event-1"), makeMatchEvent("event-2", { friendly: true })],
      totalPages: 1,
    });
    getTeamConvocationsSummaryMock.mockResolvedValue([
      {
        eventId: "event-1",
        convocationId: "c1",
        teamPlayerId: "tp-1",
        playerId: "p-1",
        alias: "J1",
        statusId: 2,
        assistanceTypeId: null,
        excuseTypeId: null,
      },
      {
        eventId: "event-2",
        convocationId: "c2",
        teamPlayerId: "tp-1",
        playerId: "p-1",
        alias: "J1",
        statusId: 2,
        assistanceTypeId: null,
        excuseTypeId: null,
      },
    ]);
    getMatchMinutesMock.mockResolvedValue([
      { eventId: "event-1", teamPlayerId: "tp-1", minutesPlayed: 90 },
      { eventId: "event-2", teamPlayerId: "tp-1", minutesPlayed: 45 },
    ]);
    getSeasonPlayerMinutesMock.mockResolvedValue({ "tp-1": 315 });
    excuseTypeServiceGetExcuseTypesMock.mockResolvedValue([]);
  });

  it("incluye la jornada amistosa en la pestaña de partidos junto a la oficial", async () => {
    render(<AttendanceSummaryContent teamId="team-1" />);

    const matchesTab = await screen.findByRole("tab", { name: /partidos/i });
    matchesTab.click();

    // League matches and friendlies are counted (and numbered) independently:
    // 1 jornada de liga + 1 amistoso, not "2 jornadas".
    expect(await screen.findByText("1 jornadas")).toBeInTheDocument();
    expect(screen.getByText("1 amistosos")).toBeInTheDocument();
    expect(screen.getByText("Amistoso")).toBeInTheDocument();
  });

  it("muestra los minutos jugados por partido y el total de temporada", async () => {
    render(<AttendanceSummaryContent teamId="team-1" />);

    const matchesTab = await screen.findByRole("tab", { name: /partidos/i });
    matchesTab.click();

    await waitFor(() => expect(screen.getByText("90'")).toBeInTheDocument());
    expect(screen.getByText("45'")).toBeInTheDocument();
    expect(screen.getByText(/315/)).toBeInTheDocument();
  });

  it("incluye un partido amistoso con el nombre de tipo real del backend (Amistoso, no Partido)", async () => {
    // Regression test: the backend seeds the friendly SportEventType as "Amistoso"
    // (eventTypeId 4), not as a variant of "Partido". classifyEventType() must
    // recognize this type name as a match, or the event never reaches the
    // matches tab regardless of matchCategory.
    getSportEventsMock.mockResolvedValue({
      items: [makeMatchEvent("event-1"), makeRealisticFriendlyEvent("event-2")],
      totalPages: 1,
    });

    render(<AttendanceSummaryContent teamId="team-1" />);

    const matchesTab = await screen.findByRole("tab", { name: /partidos/i });
    matchesTab.click();

    expect(await screen.findByText("1 jornadas")).toBeInTheDocument();
    expect(screen.getByText("1 amistosos")).toBeInTheDocument();
    expect(screen.getByText("Amistoso")).toBeInTheDocument();
  });

  it("numera las jornadas de liga como J1, J2... y los amistosos como A1, A2... por separado", async () => {
    // Use a player alias that can't collide with the "J1"/"A1" match labels under test.
    getPlayersByTeamMock.mockResolvedValue([
      { id: "tp-1", playerId: "p-1", name: "Estrella", lastName: "Once", alias: "Estrella Once" },
    ]);
    getSportEventsMock.mockResolvedValue({
      items: [
        makeMatchEvent("league-1"),
        makeRealisticFriendlyEvent("friendly-1", "2026-01-05T10:00:00Z"),
        { ...makeMatchEvent("league-2"), startTime: "2026-01-10T10:00:00Z" },
      ],
      totalPages: 1,
    });
    getTeamConvocationsSummaryMock.mockResolvedValue([
      { eventId: "league-1", convocationId: "c1", teamPlayerId: "tp-1", playerId: "p-1", alias: "Estrella Once", statusId: 2, assistanceTypeId: null, excuseTypeId: null },
      { eventId: "friendly-1", convocationId: "c2", teamPlayerId: "tp-1", playerId: "p-1", alias: "Estrella Once", statusId: 2, assistanceTypeId: null, excuseTypeId: null },
      { eventId: "league-2", convocationId: "c3", teamPlayerId: "tp-1", playerId: "p-1", alias: "Estrella Once", statusId: 2, assistanceTypeId: null, excuseTypeId: null },
    ]);

    render(<AttendanceSummaryContent teamId="team-1" />);

    const matchesTab = await screen.findByRole("tab", { name: /partidos/i });
    matchesTab.click();

    // Expand the player's card to see the per-match detail labels.
    const cardToggle = await screen.findByRole("button", { name: /Estrella Once/i });
    cardToggle.click();

    expect(await screen.findByText(/^J1/)).toBeInTheDocument();
    expect(screen.getByText(/^J2/)).toBeInTheDocument();
    expect(screen.getByText(/^A1/)).toBeInTheDocument();
  });

  it("no cuenta los torneos todavía (soporte pendiente)", async () => {
    getSportEventsMock.mockResolvedValue({
      items: [makeMatchEvent("event-1"), makeRealisticTournamentEvent("event-2")],
      totalPages: 1,
    });

    render(<AttendanceSummaryContent teamId="team-1" />);

    const matchesTab = await screen.findByRole("tab", { name: /partidos/i });
    matchesTab.click();

    expect(await screen.findByText("1 jornadas")).toBeInTheDocument();
    expect(screen.queryByText(/amistosos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Torneo/)).not.toBeInTheDocument();
  });

  it("muestra Convocado (no Desconvocado) para un jugador convocado que aún no ha aceptado (statusId Pending)", async () => {
    // Regression: a convocation with status "Pending" (id 1) means the player
    // WAS called up by the coach and simply hasn't confirmed acceptance yet —
    // it must not be conflated with "Deconvoke" (id 5), which is the only
    // status that means the player is genuinely not called.
    getTeamConvocationsSummaryMock.mockResolvedValue([
      {
        eventId: "event-1",
        convocationId: "c1",
        teamPlayerId: "tp-1",
        playerId: "p-1",
        alias: "J1",
        statusId: 1,
        assistanceTypeId: null,
        excuseTypeId: null,
      },
    ]);

    render(<AttendanceSummaryContent teamId="team-1" />);

    const matchesTab = await screen.findByRole("tab", { name: /partidos/i });
    matchesTab.click();

    const cardToggle = await screen.findByRole("button", { name: /J1/i });
    cardToggle.click();

    expect(await screen.findByText("Convocado")).toBeInTheDocument();
    expect(screen.queryByText("Desconvocado")).not.toBeInTheDocument();
  });

  it("cuenta los partidos amistosos finalizados en la tarjeta Partidos del dashboard, no solo en Resumen global", async () => {
    // Regression: with 1 official + 1 friendly finished match, both events must
    // land in the "Partidos" dashboard tile — a friendly is still a match for
    // this aggregate, only the Matches tab distinguishes J1 (liga) vs A1 (amistoso).
    render(<AttendanceSummaryContent teamId="team-1" />);

    const dashboardTab = await screen.findByRole("tab", { name: /dashboard/i });
    dashboardTab.click();

    const globalCard = (await screen.findByText("Resumen global")).closest("article") as HTMLElement;
    const matchCard = screen.getByText("Partidos").closest("article") as HTMLElement;
    const otherCard = screen.getByText("Otros eventos").closest("article") as HTMLElement;

    await waitFor(() =>
      expect(within(globalCard).getByText("Eventos").parentElement).toHaveTextContent("2")
    );
    expect(within(matchCard).getByText("Eventos").parentElement).toHaveTextContent("2");
    expect(within(otherCard).getByText("Eventos").parentElement).toHaveTextContent("0");
  });

  it("usa la titularidad real del partido (isStarter) en vez de la alineación ideal del equipo", async () => {
    // Regression: "Titular" must reflect what actually happened in this specific
    // match (MatchParticipation.IsStarter, via getMatchMinutes), not a single
    // team-wide "ideal lineup" applied identically to every match. The ideal
    // lineup mock below intentionally has empty slots to prove it's no longer consulted.
    getMatchMinutesMock.mockResolvedValue([
      { eventId: "event-1", teamPlayerId: "tp-1", minutesPlayed: 90, isStarter: true },
      { eventId: "event-2", teamPlayerId: "tp-1", minutesPlayed: 20, isStarter: false },
    ]);

    render(<AttendanceSummaryContent teamId="team-1" />);

    const matchesTab = await screen.findByRole("tab", { name: /partidos/i });
    matchesTab.click();

    const cardToggle = await screen.findByRole("button", { name: /J1/i });
    cardToggle.click();

    expect(await screen.findByText("Titular")).toBeInTheDocument();
    expect(screen.getByText("Convocado")).toBeInTheDocument();
  });

  it("clasifica una desconvocatoria con excuseTypeId de lesión como Lesión (letra L) en el detalle", async () => {
    excuseTypeServiceGetExcuseTypesMock.mockResolvedValue([
      { id: 10, name: "Lesión", justified: true },
    ]);
    getTeamConvocationsSummaryMock.mockResolvedValue([
      {
        eventId: "event-1",
        convocationId: "c1",
        teamPlayerId: "tp-1",
        playerId: "p-1",
        alias: "J1",
        statusId: 5,
        assistanceTypeId: null,
        excuseTypeId: 10,
      },
    ]);

    render(<AttendanceSummaryContent teamId="team-1" />);

    const matchesTab = await screen.findByRole("tab", { name: /partidos/i });
    matchesTab.click();

    const cardToggle = await screen.findByRole("button", { name: /J1/i });
    cardToggle.click();

    expect(await screen.findByText("Lesión")).toBeInTheDocument();
  });

  it("clasifica una desconvocatoria sin excuseTypeId como decisión técnica (comportamiento previo)", async () => {
    getTeamConvocationsSummaryMock.mockResolvedValue([
      {
        eventId: "event-1",
        convocationId: "c1",
        teamPlayerId: "tp-1",
        playerId: "p-1",
        alias: "J1",
        statusId: 5,
        assistanceTypeId: null,
        excuseTypeId: null,
      },
    ]);

    render(<AttendanceSummaryContent teamId="team-1" />);

    const matchesTab = await screen.findByRole("tab", { name: /partidos/i });
    matchesTab.click();

    const cardToggle = await screen.findByRole("button", { name: /J1/i });
    cardToggle.click();

    expect(await screen.findByText("Decisión técnica")).toBeInTheDocument();
  });
});
