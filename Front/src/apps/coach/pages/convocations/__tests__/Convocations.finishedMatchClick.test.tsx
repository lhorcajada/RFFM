import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { UserProvider } from "../../../../../shared/context/UserContext";
import type { NormalizedMatch } from "../types";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const today = new Date();
const finishedMatchDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;

const finishedMatch: NormalizedMatch = {
  date: finishedMatchDate,
  time: "18:00",
  localTeamName: "Equipo Local",
  localTeamShield: "",
  localGoals: "2",
  visitorTeamName: "Equipo Visitante",
  visitorTeamShield: "",
  visitorGoals: "1",
  isFinished: true,
  isHomeTeam: true,
  field: "Campo Municipal",
  codacta: null,
  selectedKitNumber: null,
  locationMapUrl: null,
  eventId: "event-1",
  matchCategory: "League",
};

vi.mock("../hooks/useConvocations", () => ({
  default: () => ({
    matches: [finishedMatch],
    loading: false,
    error: null,
    federationTeamId: "team-1",
    settingsLoading: false,
    syncing: false,
    syncSnackbar: null,
    setSyncSnackbar: vi.fn(),
    handleSyncCalendar: vi.fn(),
  }),
}));

vi.mock("../../../hooks/useTeamDashboardBack", () => ({
  default: () => vi.fn(),
}));

vi.mock("../../../hooks/useEventAttendanceSummaries", () => ({
  default: () => ({ summaries: {} }),
}));

vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => ["Coach"],
    getToken: () => null,
    isAuthenticated: () => true,
  },
}));

import Convocations from "../Convocations";

function renderPage() {
  render(
    <UserProvider>
      <MemoryRouter initialEntries={["/coach/convocations?teamId=team-1"]}>
        <Convocations />
      </MemoryRouter>
    </UserProvider>
  );
}

describe("Convocations — clic en partido finalizado", () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it("navega al detalle de convocatoria al hacer clic en un partido finalizado", () => {
    renderPage();

    const matchCard = screen.getAllByText("Equipo Local")[0].closest('[role="button"]');
    expect(matchCard).not.toBeNull();
    fireEvent.click(matchCard as HTMLElement);

    expect(navigateMock).toHaveBeenCalledWith(
      expect.stringContaining("/coach/convocations/match"),
      expect.objectContaining({ state: { match: finishedMatch } })
    );
  });
});
