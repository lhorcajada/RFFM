import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockNavigate = vi.fn();
const mockUseParams = vi.fn();
const mockUseLocation = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockUseParams(),
    useLocation: () => mockUseLocation(),
  };
});

const mockGetTeamById = vi.fn();
const mockUpdateTeam = vi.fn();
const mockFetchTeamPhoto = vi.fn();
vi.mock("../../../../services/teamService", () => ({
  default: {
    getTeamById: (...args: unknown[]) => mockGetTeamById(...args),
    updateTeam: (...args: unknown[]) => mockUpdateTeam(...args),
    fetchTeamPhoto: (...args: unknown[]) => mockFetchTeamPhoto(...args),
    uploadTeamPhoto: vi.fn(),
  },
}));

const mockGetCompetitions = vi.fn();
const mockGetGroups = vi.fn();
const mockGetGroupTeams = vi.fn();
vi.mock("../../../../services/rffmCompetitionService", () => ({
  default: {
    getCompetitions: (...args: unknown[]) => mockGetCompetitions(...args),
    getGroups: (...args: unknown[]) => mockGetGroups(...args),
    getGroupTeams: (...args: unknown[]) => mockGetGroupTeams(...args),
    updateTeamCompetition: (...args: unknown[]) => mockUpdateTeamCompetitionFn(...args),
  },
}));
const mockUpdateTeamCompetitionFn = vi.fn();

import { MemoryRouter } from "react-router-dom";
import { UserProvider } from "../../../../../../shared/context/UserContext";
import EditTeam from "../EditTeam";

function renderEditTeam() {
  return render(
    <MemoryRouter>
      <UserProvider>
        <EditTeam />
      </UserProvider>
    </MemoryRouter>
  );
}

describe("EditTeam - competición real RFFM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ id: "club-1", teamId: "team-1" });
    mockUseLocation.mockReturnValue({ pathname: "/coach/clubs/club-1/teams/team-1/edit", search: "" });
    mockGetTeamById.mockResolvedValue({
      id: "team-1",
      name: "Equipo A",
      category: { id: 1, name: "Categoría 1" },
      league: { id: null, name: null, group: null },
      urlPhoto: null,
    });
    mockGetCompetitions.mockResolvedValue([
      { id: 1, name: "Liga Nacional", categoryGroup: "Cadete" },
    ]);
    mockGetGroups.mockResolvedValue([{ id: 10, name: "Grupo A" }]);
    mockGetGroupTeams.mockResolvedValue([
      { teamCode: "9001", teamName: "CD Ejemplo A" },
      { teamCode: "9002", teamName: "UD Rival B" },
    ]);
    mockUpdateTeamCompetitionFn.mockResolvedValue(undefined);
  });

  it("muestra el selector de competición real de RFFM, separado del catálogo local de ligas", async () => {
    renderEditTeam();

    await waitFor(() => expect(mockGetTeamById).toHaveBeenCalled());
    expect(await screen.findByLabelText("Competición RFFM")).toBeInTheDocument();
    expect(screen.getByLabelText("Grupo RFFM")).toBeInTheDocument();
  });

  it("guarda la asociación de competición y grupo RFFM al equipo", async () => {
    renderEditTeam();

    await waitFor(() => expect(mockGetTeamById).toHaveBeenCalled());
    await userEvent.click(await screen.findByLabelText("Competición RFFM"));
    await userEvent.click(await screen.findByRole("option", { name: "Liga Nacional" }));

    await waitFor(() => expect(mockGetGroups).toHaveBeenCalledWith(1));
    await userEvent.click(screen.getByLabelText("Grupo RFFM"));
    await userEvent.click(await screen.findByRole("option", { name: "Grupo A" }));

    await userEvent.click(screen.getByRole("button", { name: "Guardar competición RFFM" }));

    await waitFor(() =>
      expect(mockUpdateTeamCompetitionFn).toHaveBeenCalledWith("team-1", {
        competitionId: 1,
        groupId: 10,
        teamCode: null,
      })
    );
  });

  it("guarda también el equipo RFFM elegido dentro del grupo", async () => {
    mockGetTeamById.mockResolvedValue({
      id: "team-1",
      name: "Equipo A",
      category: { id: 1, name: "Categoría 1" },
      league: { id: null, name: null, group: null },
      urlPhoto: null,
      rffmCompetitionId: 1,
      rffmGroupId: 10,
    });
    renderEditTeam();

    await waitFor(() => expect(mockGetGroupTeams).toHaveBeenCalledWith(1, 10));
    await userEvent.click(await screen.findByRole("combobox", { name: "Equipo RFFM" }));
    await userEvent.click(await screen.findByRole("option", { name: "UD Rival B" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar competición RFFM" }));

    await waitFor(() =>
      expect(mockUpdateTeamCompetitionFn).toHaveBeenCalledWith("team-1", {
        competitionId: 1,
        groupId: 10,
        teamCode: "9002",
      })
    );
  });

  it("precarga el equipo RFFM guardado", async () => {
    mockGetTeamById.mockResolvedValue({
      id: "team-1",
      name: "Equipo A",
      category: { id: 1, name: "Categoría 1" },
      league: { id: null, name: null, group: null },
      urlPhoto: null,
      rffmCompetitionId: 1,
      rffmGroupId: 10,
      rffmTeamCode: "9001",
    });

    renderEditTeam();

    expect(await screen.findByText("CD Ejemplo A")).toBeInTheDocument();
  });

  it("al cambiar de grupo olvida el equipo RFFM elegido", async () => {
    mockGetGroups.mockResolvedValue([
      { id: 10, name: "Grupo A" },
      { id: 11, name: "Grupo B" },
    ]);
    mockGetTeamById.mockResolvedValue({
      id: "team-1",
      name: "Equipo A",
      category: { id: 1, name: "Categoría 1" },
      league: { id: null, name: null, group: null },
      urlPhoto: null,
      rffmCompetitionId: 1,
      rffmGroupId: 10,
      rffmTeamCode: "9001",
    });
    renderEditTeam();
    await screen.findByText("CD Ejemplo A");

    await userEvent.click(screen.getByLabelText("Grupo RFFM"));
    await userEvent.click(await screen.findByRole("option", { name: "Grupo B" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar competición RFFM" }));

    await waitFor(() =>
      expect(mockUpdateTeamCompetitionFn).toHaveBeenCalledWith("team-1", {
        competitionId: 1,
        groupId: 11,
        teamCode: null,
      })
    );
  });

  it("precarga la competición y el grupo RFFM cuando el equipo ya los tiene asignados", async () => {
    mockGetTeamById.mockResolvedValue({
      id: "team-1",
      name: "Equipo A",
      category: { id: 1, name: "Categoría 1" },
      league: { id: null, name: null, group: null },
      urlPhoto: null,
      rffmCompetitionId: 1,
      rffmGroupId: 10,
    });

    renderEditTeam();

    await waitFor(() => expect(mockGetTeamById).toHaveBeenCalled());
    await waitFor(() => expect(mockGetGroups).toHaveBeenCalledWith(1));

    expect(await screen.findByText("Liga Nacional")).toBeInTheDocument();
    expect(await screen.findByText("Grupo A")).toBeInTheDocument();
  });

  it("muestra un mensaje de error si falla al guardar la competición RFFM", async () => {
    mockUpdateTeamCompetitionFn.mockRejectedValue({
      response: { data: { detail: "No se pudo guardar" } },
    });

    renderEditTeam();

    await waitFor(() => expect(mockGetTeamById).toHaveBeenCalled());
    await userEvent.click(await screen.findByLabelText("Competición RFFM"));
    await userEvent.click(await screen.findByRole("option", { name: "Liga Nacional" }));
    await waitFor(() => expect(mockGetGroups).toHaveBeenCalledWith(1));

    await userEvent.click(screen.getByRole("button", { name: "Guardar competición RFFM" }));

    expect(await screen.findByText("No se pudo guardar")).toBeInTheDocument();
  });
});
