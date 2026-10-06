import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import Trainings from "../Trainings";
import { UserProvider } from "../../../../../shared/context/UserContext";

const mockGetSessions = vi.fn();

vi.mock("../../../services/trainingService", () => ({
  default: {
    getExercises: vi.fn().mockResolvedValue([]),
    getSessions: (...args: unknown[]) => mockGetSessions(...args),
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
  default: {
    getActiveSeason: vi.fn().mockResolvedValue({ id: "season-2", name: "2026-2027" }),
    getSeasons: vi.fn().mockResolvedValue([
      { id: "season-1", name: "2025-2026" },
      { id: "season-2", name: "2026-2027" },
    ]),
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

function renderPage() {
  return render(
    <UserProvider>
      <MemoryRouter initialEntries={["/coach/trainings?teamId=team-1"]}>
        <Trainings />
      </MemoryRouter>
    </UserProvider>
  );
}

describe("Trainings — filtro de sesiones por temporada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSessions.mockResolvedValue([]);
  });

  it("selecciona la temporada activa por defecto y pide sus sesiones", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: "Sesiones" }));

    expect(await screen.findByRole("combobox", { name: "Temporada" })).toHaveTextContent("2026-2027");
    await waitFor(() => expect(mockGetSessions).toHaveBeenCalledWith("team-1", "season-2"));
  });

  it("vuelve a pedir las sesiones al cambiar de temporada", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: "Sesiones" }));
    await user.click(await screen.findByRole("combobox", { name: "Temporada" }));
    await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: "2025-2026" }));

    await waitFor(() => expect(mockGetSessions).toHaveBeenCalledWith("team-1", "season-1"));
  });

  it("pide todas las sesiones sin temporada al elegir Todas", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: "Sesiones" }));
    await user.click(await screen.findByRole("combobox", { name: "Temporada" }));
    await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Todas" }));

    await waitFor(() => expect(mockGetSessions).toHaveBeenLastCalledWith("team-1", undefined));
  });
});
