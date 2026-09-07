import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import Trainings from "../Trainings";
import { UserProvider } from "../../../../../shared/context/UserContext";
import type { TrainingSession } from "../../../types/training";

const mockGetSessions = vi.fn();
const mockDeleteSessions = vi.fn();

vi.mock("../../../services/trainingService", () => ({
  default: {
    getExercises: vi.fn().mockResolvedValue([]),
    getSessions: (...args: unknown[]) => mockGetSessions(...args),
    deleteSession: vi.fn(),
    deleteSessions: (...args: unknown[]) => mockDeleteSessions(...args),
  },
  hasErrorCode: () => false,
}));

vi.mock("../../../services/seasonPlanService", () => ({
  default: {
    getByTeamIdAndSeason: vi.fn().mockResolvedValue(null),
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

describe("Trainings — borrado en bulk de sesiones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSessions.mockResolvedValue([makeSession("sess-1", "Sesión 1"), makeSession("sess-2", "Sesión 2")]);
    mockDeleteSessions.mockResolvedValue({ deletedCount: 2 });
  });

  it("permite seleccionar varias sesiones y eliminarlas en bulk", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: "Sesiones" }));
    await screen.findByText("Sesión 1");

    // Checkbox order: "select all" first, then one per session card.
    const [, sessionCheckbox1, sessionCheckbox2] = screen.getAllByRole("checkbox");
    await user.click(sessionCheckbox1);
    await user.click(sessionCheckbox2);

    const bulkDeleteButton = screen.getByRole("button", { name: /eliminar seleccionadas/i });
    await user.click(bulkDeleteButton);

    const confirmButton = await screen.findByRole("button", { name: "Eliminar" });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockDeleteSessions).toHaveBeenCalledWith(["sess-1", "sess-2"]);
    });
  });

  it("no muestra el botón de eliminar seleccionadas cuando no hay ninguna sesión marcada", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: "Sesiones" }));
    await screen.findByText("Sesión 1");

    expect(screen.queryByRole("button", { name: /eliminar seleccionadas/i })).not.toBeInTheDocument();
  });
});
