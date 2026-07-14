import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockGetTeams = vi.fn();
vi.mock("../../../../../services/teamService", () => ({
  default: {
    getTeams: (...args: unknown[]) => mockGetTeams(...args),
  },
}));

const mockGetSeasons = vi.fn();
vi.mock("../../../../../services/seasonService", () => ({
  default: {
    getSeasons: (...args: unknown[]) => mockGetSeasons(...args),
  },
}));

const mockGetClubById = vi.fn();
const mockGetUserClubs = vi.fn();
vi.mock("../../../../../services/clubService", () => ({
  default: {
    getClubById: (...args: unknown[]) => mockGetClubById(...args),
    getUserClubs: (...args: unknown[]) => mockGetUserClubs(...args),
  },
}));

const mockUseMediaQuery = vi.fn();
vi.mock("@mui/material/useMediaQuery", () => ({
  default: (...args: unknown[]) => mockUseMediaQuery(...args),
}));

const mockRegenerateInvitation = vi.fn();
vi.mock("../../../../../../../shared/services/scopes/scopesApi", () => ({
  scopesApi: {
    regenerateInvitation: (...args: unknown[]) => mockRegenerateInvitation(...args),
  },
}));

import TeamManager from "../TeamManager";

describe("TeamManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSeasons.mockResolvedValue([{ id: "season-1", name: "Temporada 25/26", active: true }]);
    mockGetTeams.mockResolvedValue([]);
    mockGetClubById.mockResolvedValue({ id: "club-1", name: "FC Uno" });
    mockGetUserClubs.mockResolvedValue([
      { clubId: "club-1", clubName: "FC Uno", shieldUrl: "", role: "Coach", roleId: 2, isCreator: true },
    ]);
    mockUseMediaQuery.mockReturnValue(false);
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("en escritorio muestra los equipos en una tabla", async () => {
    mockGetTeams.mockResolvedValue([
      {
        id: "team-1",
        name: "Alevín A",
        category: { name: "Alevín" },
        league: { name: "Liga Local", group: "Grupo 2" },
      },
    ]);
    mockUseMediaQuery.mockReturnValue(false);

    render(<TeamManager clubId="club-1" />);

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Nombre" })).toBeInTheDocument();
    expect(screen.getByText("Alevín A")).toBeInTheDocument();
    expect(screen.queryByTestId("team-row-card-team-1")).not.toBeInTheDocument();
  });

  it("en móvil/tablet muestra los equipos como tarjetas en vez de tabla", async () => {
    mockGetTeams.mockResolvedValue([
      {
        id: "team-1",
        name: "Alevín A",
        category: { name: "Alevín" },
        league: { name: "Liga Local", group: "Grupo 2" },
      },
    ]);
    mockUseMediaQuery.mockReturnValue(true);

    render(<TeamManager clubId="club-1" />);

    await screen.findByText("Alevín A");

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const card = screen.getByTestId("team-row-card-team-1");
    expect(within(card).getByText("Alevín A")).toBeInTheDocument();
    expect(within(card).getByText("Alevín")).toBeInTheDocument();
    expect(within(card).getByText("Liga Local")).toBeInTheDocument();
    expect(within(card).getByText("Grupo 2")).toBeInTheDocument();
  });

  it("muestra siempre el botón 'Crear equipo' aunque no haya equipos", async () => {
    render(<TeamManager clubId="" />);

    expect(screen.getByRole("button", { name: /crear equipo/i })).toBeInTheDocument();
  });

  it("navega directamente al formulario de creación cuando hay club preferido", async () => {
    render(<TeamManager clubId="club-1" />);

    await waitFor(() => expect(mockGetTeams).toHaveBeenCalled());

    await userEvent.click(screen.getByRole("button", { name: /crear equipo/i }));

    expect(mockNavigate).toHaveBeenCalledWith(
      "/coach/clubs/club-1/teams/new",
      expect.objectContaining({ state: expect.objectContaining({ from: "settings" }) })
    );
  });

  it("pide seleccionar un club antes de continuar cuando no hay club preferido", async () => {
    render(<TeamManager clubId="" />);

    await userEvent.click(screen.getByRole("button", { name: /crear equipo/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/selecciona un club/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByLabelText("Club"));
    const option = await screen.findByRole("option", { name: "FC Uno" });
    await userEvent.click(option);

    await userEvent.click(within(dialog).getByRole("button", { name: /continuar/i }));

    expect(mockNavigate).toHaveBeenCalledWith(
      "/coach/clubs/club-1/teams/new",
      expect.objectContaining({ state: expect.objectContaining({ from: "settings" }) })
    );
  });

  it("en escritorio muestra el código de invitación y permite copiarlo", async () => {
    mockGetTeams.mockResolvedValue([
      {
        id: "team-1",
        name: "Alevín A",
        category: { name: "Alevín" },
        league: { name: "Liga Local", group: "Grupo 2" },
        joinCode: "ABC123",
      },
    ]);
    mockUseMediaQuery.mockReturnValue(false);
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    render(<TeamManager clubId="club-1" />);

    expect(await screen.findByText("ABC123")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /copiar código/i }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("ABC123");
    await waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "rffm.show_snackbar",
          detail: expect.objectContaining({ severity: "success" }),
        })
      );
    });
  });

  it("en escritorio muestra un botón para generar el código cuando no existe", async () => {
    mockGetTeams.mockResolvedValue([
      {
        id: "team-1",
        name: "Alevín A",
        category: { name: "Alevín" },
        league: { name: "Liga Local", group: "Grupo 2" },
        joinCode: null,
      },
    ]);
    mockUseMediaQuery.mockReturnValue(false);

    render(<TeamManager clubId="club-1" />);

    expect(await screen.findByRole("button", { name: /generar código/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copiar código/i })).not.toBeInTheDocument();
  });

  it("genera el código de invitación de un equipo y lo muestra sin recargar toda la lista", async () => {
    mockGetTeams.mockResolvedValue([
      {
        id: "team-1",
        name: "Alevín A",
        category: { name: "Alevín" },
        league: { name: "Liga Local", group: "Grupo 2" },
        joinCode: null,
      },
    ]);
    mockUseMediaQuery.mockReturnValue(false);
    mockRegenerateInvitation.mockResolvedValue({
      scopeKind: "team",
      scopeId: "team-1",
      newCode: "NEWCODE1",
    });

    render(<TeamManager clubId="club-1" />);

    const generateButton = await screen.findByRole("button", { name: /generar código/i });
    await userEvent.click(generateButton);

    expect(mockRegenerateInvitation).toHaveBeenCalledWith({ scopeKind: "team", scopeId: "team-1" });

    expect(await screen.findByText("NEWCODE1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /generar código/i })).not.toBeInTheDocument();
    expect(mockGetTeams).toHaveBeenCalledTimes(1);
  });

  it("en móvil muestra el código de invitación dentro de la tarjeta del equipo", async () => {
    mockGetTeams.mockResolvedValue([
      {
        id: "team-1",
        name: "Alevín A",
        category: { name: "Alevín" },
        league: { name: "Liga Local", group: "Grupo 2" },
        joinCode: "ABC123",
      },
    ]);
    mockUseMediaQuery.mockReturnValue(true);

    render(<TeamManager clubId="club-1" />);

    const card = await screen.findByTestId("team-row-card-team-1");
    expect(within(card).getByText("ABC123")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: /copiar código/i })).toBeInTheDocument();
  });
});
