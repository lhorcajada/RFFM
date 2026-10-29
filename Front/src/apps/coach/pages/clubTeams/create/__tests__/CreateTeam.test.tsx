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
const mockGetTeams = vi.fn();
const mockCreateTeamsBatch = vi.fn();
vi.mock("../../../../services/teamService", () => ({
  default: {
    createTeam: (...args: unknown[]) => mockCreateTeam(...args),
    getTeams: (...args: unknown[]) => mockGetTeams(...args),
    createTeamsBatch: (...args: unknown[]) => mockCreateTeamsBatch(...args),
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
    mockGetTeams.mockResolvedValue([
      { id: "t-a", name: "Categoría 1 A", category: { id: 1, name: "Categoría 1" } },
    ]);
    mockCreateTeamsBatch.mockResolvedValue({
      created: [{ id: "n1", name: "Categoría 1 B" }],
      skipped: [],
    });
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

  describe("creación de equipos", () => {
    function renderBatch(state: unknown = null) {
      mockUseLocation.mockReturnValue({ pathname: "/coach/clubs/club-1/teams/new", search: "", state });
      render(
        <MemoryRouter>
          <UserProvider>
            <CreateTeam />
          </UserProvider>
        </MemoryRouter>
      );
    }

    async function pickCategory() {
      await userEvent.click(await screen.findByLabelText("Categoría"));
      await userEvent.click(await screen.findByRole("option", { name: "Categoría 1" }));
    }

    it("no muestra selector de modo ni campo Nombre", () => {
      renderBatch();
      expect(screen.queryByRole("button", { name: "Un equipo" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Varios equipos" })).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();
    });

    it("al elegir categoría muestra las letras de los equipos", async () => {
      renderBatch();
      await pickCategory();
      expect(await screen.findByText("Letras de los equipos")).toBeInTheDocument();
    });

    it("bloquea las letras de equipos existentes de la categoría", async () => {
      renderBatch();
      await pickCategory();
      expect(await screen.findByRole("button", { name: "Categoría 1 A, ya existe" })).toBeDisabled();
      expect(mockGetTeams).toHaveBeenCalledWith("club-1");
    });

    it("envía las letras seleccionadas al servicio y vuelve a la lista", async () => {
      const snackbar = vi.fn();
      window.addEventListener("rffm.show_snackbar", snackbar as EventListener);
      renderBatch();
      await pickCategory();
      await userEvent.click(await screen.findByRole("button", { name: "Categoría 1 B" }));
      await userEvent.click(screen.getByRole("button", { name: "Crear 1 equipo" }));

      await waitFor(() =>
        expect(mockCreateTeamsBatch).toHaveBeenCalledWith("club-1", {
          categoryId: 1,
          leagueId: null,
          letters: ["B"],
        })
      );
      expect(mockCreateTeam).not.toHaveBeenCalled();
      expect(snackbar).toHaveBeenCalled();
      expect((snackbar.mock.calls[0][0] as CustomEvent).detail).toMatchObject({
        message: "1 equipo creado",
        severity: "success",
      });
      expect(mockNavigate).toHaveBeenCalledWith("/coach/clubs/club-1/teams");
      window.removeEventListener("rffm.show_snackbar", snackbar as EventListener);
    });

    it("indica cuántos equipos ya existían si el servidor omite alguno", async () => {
      mockCreateTeamsBatch.mockResolvedValue({
        created: [{ id: "n1", name: "Categoría 1 B" }],
        skipped: ["Categoría 1 C"],
      });
      const snackbar = vi.fn();
      window.addEventListener("rffm.show_snackbar", snackbar as EventListener);
      renderBatch();
      await pickCategory();
      await userEvent.click(await screen.findByRole("button", { name: "Categoría 1 B" }));
      await userEvent.click(screen.getByRole("button", { name: "Crear 1 equipo" }));

      await waitFor(() => expect(snackbar).toHaveBeenCalled());
      expect((snackbar.mock.calls[0][0] as CustomEvent).detail.message).toBe(
        "1 equipo creado, 1 ya existía"
      );
      window.removeEventListener("rffm.show_snackbar", snackbar as EventListener);
    });

    it("vuelve a Ajustes cuando viene del flujo de ajustes", async () => {
      renderBatch({ from: "settings" });
      await pickCategory();
      await userEvent.click(await screen.findByRole("button", { name: "Categoría 1 B" }));
      await userEvent.click(screen.getByRole("button", { name: "Crear 1 equipo" }));

      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith("/coach/settings", { state: { section: "teams" } })
      );
    });

    it("muestra un snackbar de error y no navega si el servicio falla", async () => {
      mockCreateTeamsBatch.mockRejectedValue({ response: { data: { detail: "Categoría inválida" } } });
      const snackbar = vi.fn();
      window.addEventListener("rffm.show_snackbar", snackbar as EventListener);
      renderBatch();
      await pickCategory();
      await userEvent.click(await screen.findByRole("button", { name: "Categoría 1 B" }));
      await userEvent.click(screen.getByRole("button", { name: "Crear 1 equipo" }));

      await waitFor(() => expect(snackbar).toHaveBeenCalled());
      expect((snackbar.mock.calls[0][0] as CustomEvent).detail).toMatchObject({
        message: "Categoría inválida",
        severity: "error",
      });
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Crear 1 equipo" })).toBeEnabled();
      window.removeEventListener("rffm.show_snackbar", snackbar as EventListener);
    });

    it("mantiene deshabilitado el botón de crear sin letras seleccionadas", async () => {
      renderBatch();
      expect(screen.getByRole("button", { name: "Crear equipos" })).toBeDisabled();
    });
  });
});
