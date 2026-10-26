import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import Trainings from "../Trainings";
import { UserProvider } from "../../../../../shared/context/UserContext";
import type { TrainingSession } from "../../../types/training";

const mockGetExercises = vi.fn();
const mockGetSessions = vi.fn();

vi.mock("../../../services/trainingService", () => ({
  default: {
    getExercises: (...args: unknown[]) => mockGetExercises(...args),
    getSessions: (...args: unknown[]) => mockGetSessions(...args),
    deleteSession: vi.fn(),
    deleteSessions: vi.fn(),
  },
  hasErrorCode: () => false,
}));

vi.mock("../components/ExerciseCromo", () => ({
  default: ({ exercise }: { exercise: { id: string } }) => <div>cromo-{exercise.id}</div>,
}));

vi.mock("../../../services/seasonPlanService", () => ({
  default: { getByTeamIdAndSeason: vi.fn().mockResolvedValue(null) },
}));

vi.mock("../../../services/gameModelService", () => ({
  default: { getZones: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../services/seasonService", () => ({
  default: {
    getActiveSeason: vi.fn().mockResolvedValue({ id: "season-1", name: "2026-2027" }),
    getSeasons: vi.fn().mockResolvedValue([{ id: "season-1", name: "2026-2027" }]),
  },
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

function makeSession(id: string, name: string): TrainingSession {
  return {
    id,
    name,
    description: "",
    date: null,
    startTime: null,
    endTime: null,
    location: null,
    sportEventId: null,
    sportEventName: null,
    microcicloId: null,
    microcicloWeekLabel: null,
    isAssociatedToPlan: false,
    exerciseCount: 0,
    targets: [],
  };
}

function renderPage() {
  return render(
    <UserProvider>
      <MemoryRouter initialEntries={["/coach/trainings?teamId=team-1"]}>
        <Trainings />
      </MemoryRouter>
    </UserProvider>
  );
}

describe("Trainings — rediseño", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetExercises.mockResolvedValue([{ id: "e1" }, { id: "e2" }, { id: "e3" }]);
    mockGetSessions.mockResolvedValue([makeSession("s1", "Sesión 1"), makeSession("s2", "Sesión 2")]);
  });

  it("muestra el recuento de ejercicios en plural", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: "Ejercicios" }));

    expect(await screen.findByText("3 ejercicios")).toBeInTheDocument();
  });

  it("muestra el recuento de ejercicios en singular", async () => {
    mockGetExercises.mockResolvedValue([{ id: "e1" }]);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: "Ejercicios" }));

    expect(await screen.findByText("1 ejercicio")).toBeInTheDocument();
  });

  it("marca la pestaña activa con aria-selected al cambiar de sección", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: "Sesiones" }));

    expect(screen.getByRole("tab", { name: "Sesiones" })).toHaveAttribute("aria-selected", "true");
  });

  it("muestra «Seleccionar todo» cuando no hay sesiones seleccionadas", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: "Sesiones" }));
    await screen.findByText("Sesión 1");

    expect(screen.getByText("Seleccionar todo")).toBeInTheDocument();
  });

  it("muestra «2 sesiones seleccionadas» al seleccionar todo", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: "Sesiones" }));
    await screen.findByText("Sesión 1");
    await user.click(screen.getAllByRole("checkbox")[0]);

    expect(screen.getByText("2 sesiones seleccionadas")).toBeInTheDocument();
  });

  it("muestra «1 sesión seleccionada» en singular", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: "Sesiones" }));
    await screen.findByText("Sesión 1");
    await user.click(screen.getAllByRole("checkbox")[1]);

    expect(screen.getByText("1 sesión seleccionada")).toBeInTheDocument();
  });
});
