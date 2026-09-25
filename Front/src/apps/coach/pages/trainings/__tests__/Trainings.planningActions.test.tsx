import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import Trainings from "../Trainings";
import { UserProvider } from "../../../../../shared/context/UserContext";
import type { SeasonPlan } from "../../../types/seasonPlan";

const planFixture: SeasonPlan = {
  id: "plan-1",
  teamId: "team-1",
  seasonId: "season-1",
  macrociclos: [
    {
      id: -1,
      apiId: "macro-1",
      order: 1,
      name: "Macrociclo 1",
      startDate: "2026-09-01",
      endDate: "2026-12-31",
      mesociclos: [
        {
          id: -2,
          apiId: "meso-1",
          order: 1,
          name: "Mesociclo 1",
          startDate: "2026-09-01",
          endDate: "2026-09-30",
          gameZoneId: 1,
          microciclos: [
            {
              id: -3,
              apiId: "micro-a",
              order: 1,
              weekLabel: "Semana 3",
              startDate: "2026-09-14",
              endDate: "2026-09-20",
              sessions: [
                { id: "sess-1", name: "Sesión martes", date: "2026-09-15", exerciseCount: 3, objetivoGeneral: null },
              ],
              weeklyObjective: [],
            },
          ],
        },
      ],
    },
  ],
};

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
  default: {
    getByTeamIdAndSeason: vi.fn(() => Promise.resolve(planFixture)),
  },
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

function ContentBoardProbe() {
  const location = useLocation();
  const state = location.state as { microciclo?: { weekLabel: string } } | null;
  return (
    <div>
      <div data-testid="board-search">{location.search}</div>
      <div data-testid="board-week">{state?.microciclo?.weekLabel ?? ""}</div>
    </div>
  );
}

function renderPage() {
  return render(
    <UserProvider>
      <MemoryRouter initialEntries={["/coach/trainings?teamId=team-1"]}>
        <Routes>
          <Route path="/coach/trainings" element={<Trainings />} />
          <Route path="/coach/trainings/content-board" element={<ContentBoardProbe />} />
        </Routes>
      </MemoryRouter>
    </UserProvider>
  );
}

describe("Trainings — acciones de planificación y tablero de contenido", () => {
  beforeEach(() => vi.clearAllMocks());

  it("la pestaña Planificación no muestra el botón 'Planificar contenido'", async () => {
    renderPage();

    await screen.findByText("Semana 3");

    expect(screen.queryByRole("button", { name: /planificar contenido/i })).not.toBeInTheDocument();
  });

  it("'Crear sesión' de un microciclo abre el tablero de contenido con ese microciclo", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /crear sesión/i }));

    expect(screen.getByTestId("board-search")).toHaveTextContent("microcicloId=micro-a");
    expect(screen.getByTestId("board-week")).toHaveTextContent("Semana 3");
  });

  it("abrir una sesión desde la Planificación pasa por el tablero de contenido de su microciclo", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /sesión martes/i }));

    expect(screen.getByTestId("board-search")).toHaveTextContent("microcicloId=micro-a");
    expect(screen.getByTestId("board-week")).toHaveTextContent("Semana 3");
  });

  it("la pestaña Sesiones abre el tablero de contenido completo sin microciclo", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: "Sesiones" }));
    await user.click(screen.getByRole("button", { name: /tablero de contenido/i }));

    expect(screen.getByTestId("board-search")).toHaveTextContent("teamId=team-1");
    expect(screen.getByTestId("board-search")).not.toHaveTextContent("microcicloId");
  });
});
