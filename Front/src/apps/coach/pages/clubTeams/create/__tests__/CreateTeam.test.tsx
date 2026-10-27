import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { UserProvider } from "../../../../../../shared/context/UserContext";

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

const mockCreateTeam = vi.fn();
vi.mock("../../../../services/teamService", () => ({
  default: {
    createTeam: (...args: unknown[]) => mockCreateTeam(...args),
  },
}));

const mockGetCategories = vi.fn();
const mockGetLeagues = vi.fn();
vi.mock("../../../../services/competitionService", () => ({
  default: {
    getCategories: (...args: unknown[]) => mockGetCategories(...args),
    getLeagues: (...args: unknown[]) => mockGetLeagues(...args),
  },
}));

const mockGetUserClubs = vi.fn();
const mockGetClubById = vi.fn();
const mockGetClubEmblem = vi.fn();
vi.mock("../../../../services/clubService", () => ({
  default: {
    getUserClubs: (...args: unknown[]) => mockGetUserClubs(...args),
    getClubById: (...args: unknown[]) => mockGetClubById(...args),
    getClubEmblem: (...args: unknown[]) => mockGetClubEmblem(...args),
  },
}));

import CreateTeam from "../CreateTeam";

describe("CreateTeam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ id: "club-1" });
    mockGetCategories.mockResolvedValue([{ id: 1, name: "Categoría 1" }]);
    mockGetLeagues.mockResolvedValue([]);
    mockGetUserClubs.mockResolvedValue([
      { clubId: "club-1", clubName: "FC Uno", shieldUrl: "", role: "Coach", roleId: 2, isCreator: true },
    ]);
    mockGetClubById.mockResolvedValue({ id: "club-1", name: "FC Uno" });
    mockGetClubEmblem.mockResolvedValue({ data: null });
    mockCreateTeam.mockResolvedValue({ id: "team-1" });
  });

  it("muestra la sección «Datos del equipo» y permite cancelar", async () => {
    mockUseLocation.mockReturnValue({ pathname: "/coach/clubs/club-1/teams/new", state: null });
    render(
      <MemoryRouter>
        <UserProvider>
          <CreateTeam />
        </UserProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Datos del equipo" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(mockNavigate).toHaveBeenCalledWith(-1);
    expect(mockCreateTeam).not.toHaveBeenCalled();
  });

  it("navega a /coach/clubs/:id/teams al guardar cuando no viene de ajustes", async () => {
    mockUseLocation.mockReturnValue({ pathname: "/coach/clubs/club-1/teams/new", search: "", state: null });

    render(
      <MemoryRouter>
        <UserProvider>
          <CreateTeam />
        </UserProvider>
      </MemoryRouter>
    );

    await userEvent.type(screen.getByLabelText("Nombre"), "Equipo A");
    await userEvent.click(screen.getByLabelText("Categoría"));
    await userEvent.click(await screen.findByRole("option", { name: "Categoría 1" }));

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(mockCreateTeam).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith("/coach/clubs/club-1/teams");
  });

  it("vuelve a Ajustes > Mis equipos al guardar cuando viene del flujo de ajustes", async () => {
    mockUseLocation.mockReturnValue({
      pathname: "/coach/clubs/club-1/teams/new",
      search: "",
      state: { from: "settings" },
    });

    render(
      <MemoryRouter>
        <UserProvider>
          <CreateTeam />
        </UserProvider>
      </MemoryRouter>
    );

    await userEvent.type(screen.getByLabelText("Nombre"), "Equipo B");
    await userEvent.click(screen.getByLabelText("Categoría"));
    await userEvent.click(await screen.findByRole("option", { name: "Categoría 1" }));

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(mockCreateTeam).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith("/coach/settings", {
      state: { section: "teams" },
    });
  });
});
