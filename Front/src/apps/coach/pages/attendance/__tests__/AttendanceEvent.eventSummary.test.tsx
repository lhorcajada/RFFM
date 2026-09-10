import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
  default: {
    getSportEventTypes: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../services/teamService", () => ({
  default: {
    getTeamById: vi.fn(),
    fetchTeamPhoto: vi.fn(),
  },
}));

vi.mock("../../../services/clubService", () => ({
  default: {
    getClubEmblem: vi.fn(),
  },
}));

const attendanceTabsSpy = vi.fn();
vi.mock("../AttendanceTabs", () => ({
  default: (props: any) => {
    attendanceTabsSpy(props);
    return null;
  },
}));

const hasRoleMock = vi.fn(() => true);
vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    hasRole: (...args: unknown[]) => hasRoleMock(...args),
  },
}));

vi.mock("../components/SportEventDialog", () => ({
  default: () => null,
}));

const getTeamKitsMock = vi.fn().mockResolvedValue([]);
vi.mock("../../../services/kitService", () => ({
  getTeamKits: (...args: unknown[]) => getTeamKitsMock(...args),
}));

let convocationMock: {
  players: unknown[];
  mgmtCalled: string[];
  mgmtNotCalled: string[];
  mgmtPending: string[];
  mgmtPhotos: Record<string, string | null>;
  mgmtExcuseMap: Record<string, number | null>;
  excuseTypes: unknown[];
};
vi.mock("../../convocations/hooks/useConvocationManagement", () => ({
  useConvocationManagement: () => convocationMock,
}));

vi.mock("../../convocations/components/ConvocationDetailsDialog", () => ({
  default: () => null,
}));

import AttendanceEvent from "../AttendanceEvent";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/coach/attendance/event-1"]}>
      <Routes>
        <Route path="/coach/attendance/:id" element={<AttendanceEvent />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AttendanceEvent - deriva eventSummary para AttendanceTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasRoleMock.mockReturnValue(true);
    getTeamKitsMock.mockResolvedValue([]);
    convocationMock = {
      players: [],
      mgmtCalled: [],
      mgmtNotCalled: [],
      mgmtPending: [],
      mgmtPhotos: {},
      mgmtExcuseMap: {},
      excuseTypes: [],
    };
  });

  it("pasa eventSummary con tipo, rival, fecha, hora y lugar a AttendanceTabs para un partido", async () => {
    getSportEventByIdMock.mockResolvedValue({
      id: "event-1",
      title: "Partido vs Rival",
      teamId: "team-1",
      eventType: "Partidos",
      rivalName: "CD Rival",
      location: "Campo Municipal",
      startTime: "2026-10-12T10:00:00",
      eveDateTime: "2026-10-12T00:00:00",
    });

    renderPage();

    await screen.findByText("Partido vs Rival");

    expect(attendanceTabsSpy).toHaveBeenCalled();
    const lastProps = attendanceTabsSpy.mock.calls[attendanceTabsSpy.mock.calls.length - 1][0];
    expect(lastProps.eventSummary).toBeDefined();
    expect(lastProps.eventSummary.eventTypeLabel).toBe("Partidos");
    expect(lastProps.eventSummary.rivalName).toBe("CD Rival");
    expect(lastProps.eventSummary.location).toBe("Campo Municipal");
    expect(typeof lastProps.eventSummary.dateES).toBe("string");
    expect(lastProps.eventSummary.dateES.length).toBeGreaterThan(0);
  });

  it("degrada correctamente (rivalName/location null) para un entrenamiento sin rival ni lugar", async () => {
    getSportEventByIdMock.mockResolvedValue({
      id: "event-1",
      title: "Entreno semanal",
      teamId: "team-1",
      eventType: "Entrenamiento",
      eveDateTime: "2026-10-12T00:00:00",
    });

    renderPage();

    await screen.findByText("Entreno semanal");

    const lastProps = attendanceTabsSpy.mock.calls[attendanceTabsSpy.mock.calls.length - 1][0];
    expect(lastProps.eventSummary.eventTypeLabel).toBe("Entrenamiento");
    expect(lastProps.eventSummary.rivalName).toBeNull();
    expect(lastProps.eventSummary.location).toBeNull();
  });
});
