import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import Trainings from "../Trainings";
import { UserProvider } from "../../../../../shared/context/UserContext";

vi.mock("../../../services/trainingService", () => ({
  default: {
    getExercises: vi.fn().mockResolvedValue([]),
    getSessions: vi.fn().mockResolvedValue([]),
    deleteSession: vi.fn(),
    deleteSessions: vi.fn(),
  },
  hasErrorCode: () => false,
}));

vi.mock("../../../services/seasonPlanService", () => ({
  default: { getByTeamIdAndSeason: vi.fn().mockResolvedValue(null) },
}));

vi.mock("../../../services/gameModelService", () => ({
  default: { getZones: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../services/seasonService", () => ({
  default: { getActiveSeason: vi.fn().mockResolvedValue({ id: "season-1", name: "2026-2027" }) },
  COACH_ACTIVE_SEASON_CHANGED_EVENT: "rffm.coach_active_season_changed",
}));

vi.mock("../../../hooks/useTeamAndClub", () => ({
  default: () => ({
    team: { id: "team-1", club: { id: "club-1" } },
    teamTitleNode: "Equipo Test",
  }),
}));

vi.mock("../../../hooks/useTeamDashboardBack", () => ({
  default: () => () => {},
}));

function renderPage() {
  return render(
    <UserProvider>
      <MemoryRouter initialEntries={["/coach/trainings?teamId=team-1"]}>
        <Routes>
          <Route path="/coach/trainings" element={<Trainings />} />
        </Routes>
      </MemoryRouter>
    </UserProvider>
  );
}

describe("Trainings — filtro de tipo de ejercicio", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra 'Todos' como valor seleccionado cuando no hay filtro de tipo", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: "Ejercicios" }));

    expect(screen.getByRole("combobox", { name: /tipo/i })).toHaveTextContent("Todos");
  });
});
