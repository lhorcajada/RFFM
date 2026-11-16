import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({ actionBar, children }: { actionBar?: React.ReactNode; children: React.ReactNode }) => (
    <>
      {actionBar}
      {children}
    </>
  ),
}));

vi.mock("../../../hooks/useTeamAndClub", () => ({
  default: vi.fn(() => ({
    team: { id: "team-1", name: "Equipo 1", club: { id: "club-1" } },
    teamTitleNode: <span>Equipo 1</span>,
    clubSubtitleNode: <span>Club 1</span>,
    loading: false,
  })),
}));

const getSportEventByIdMock = vi.fn();
vi.mock("../../../services/sportEventService", () => ({
  getSportEventById: (...args: unknown[]) => getSportEventByIdMock(...args),
}));

vi.mock("../../../services/sportEventTypeService", () => ({
  default: { getSportEventTypes: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../services/teamService", () => ({
  default: { getTeamById: vi.fn(), fetchTeamPhoto: vi.fn() },
}));

vi.mock("../../../services/clubService", () => ({
  default: { getClubEmblem: vi.fn() },
}));

vi.mock("../AttendanceTabs", () => ({
  default: () => <div>attendance-tabs</div>,
}));

const hasRoleMock = vi.fn((_role: string) => true);
vi.mock("../../../services/authService", () => ({
  coachAuthService: { hasRole: (role: string) => hasRoleMock(role) },
}));

vi.mock("../components/SportEventDialog", () => ({ default: () => null }));

vi.mock("../../../services/kitService", () => ({
  getTeamKits: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../convocations/hooks/useConvocationManagement", () => ({
  useConvocationManagement: () => ({
    players: [],
    mgmtCalled: [],
    mgmtNotCalled: [],
    mgmtPending: [],
    mgmtPhotos: {},
    mgmtExcuseMap: {},
    excuseTypes: [],
  }),
}));

vi.mock("../../convocations/components/ConvocationDetailsDialog", () => ({ default: () => null }));

vi.mock("../../../services/trainingService", () => ({
  default: { getSessions: vi.fn() },
}));

import AttendanceEvent from "../AttendanceEvent";

function MatchProbe() {
  const location = useLocation();
  return <div data-testid="match-page">{location.search}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/coach/attendance/event-1"]}>
      <Routes>
        <Route path="/coach/attendance/:id" element={<AttendanceEvent />} />
        <Route path="/coach/convocations/match" element={<MatchProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

const leagueEvent = {
  id: "event-1",
  title: "Jornada 8",
  teamId: "team-1",
  eventType: "Partido",
  matchCategory: "League",
  eveDateTime: "2026-11-21T10:30:00",
};

function setRoles(roles: string[]) {
  hasRoleMock.mockImplementation((role: string) => roles.includes(role));
}

describe("AttendanceEvent - partido de liga", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRoles(["Coach"]);
    getSportEventByIdMock.mockResolvedValue(leagueEvent);
  });

  it("lleva al entrenador directamente a la página de partido", async () => {
    renderPage();

    const probe = await screen.findByTestId("match-page");
    const search = new URLSearchParams(probe.textContent ?? "");
    expect(search.get("teamId")).toBe("team-1");
    expect(search.get("eventId")).toBe("event-1");
  });

  it("lleva al administrador directamente a la página de partido", async () => {
    setRoles(["Administrator"]);
    renderPage();

    expect(await screen.findByTestId("match-page")).toBeInTheDocument();
  });

  it.each([["Player"], ["FamilyPlayer"], ["FamilyMember"]])(
    "lleva a %s directamente a la página de partido",
    async (role) => {
      setRoles([role]);
      renderPage();

      expect(await screen.findByTestId("match-page")).toBeInTheDocument();
      expect(screen.queryByText("attendance-tabs")).not.toBeInTheDocument();
    },
  );

  it("mantiene la página de asistencia para un seguidor", async () => {
    setRoles(["Follower"]);
    renderPage();

    expect(await screen.findByText("attendance-tabs")).toBeInTheDocument();
    expect(screen.queryByTestId("match-page")).not.toBeInTheDocument();
  });

  it("mantiene la página de asistencia para un amistoso de un jugador", async () => {
    setRoles(["Player"]);
    getSportEventByIdMock.mockResolvedValue({ ...leagueEvent, matchCategory: "Friendly" });
    renderPage();

    expect(await screen.findByText("attendance-tabs")).toBeInTheDocument();
    expect(screen.queryByTestId("match-page")).not.toBeInTheDocument();
  });

  it("mantiene la página de asistencia para un amistoso del entrenador", async () => {
    getSportEventByIdMock.mockResolvedValue({ ...leagueEvent, matchCategory: "Friendly" });
    renderPage();

    expect(await screen.findByText("attendance-tabs")).toBeInTheDocument();
    expect(screen.queryByTestId("match-page")).not.toBeInTheDocument();
  });

  it("mantiene la página de asistencia para un entrenamiento del entrenador", async () => {
    getSportEventByIdMock.mockResolvedValue({ ...leagueEvent, eventType: "Entrenamiento", matchCategory: undefined });
    renderPage();

    expect(await screen.findByText("attendance-tabs")).toBeInTheDocument();
    expect(screen.queryByTestId("match-page")).not.toBeInTheDocument();
  });
});
