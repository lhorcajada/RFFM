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
});
