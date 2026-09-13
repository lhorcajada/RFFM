import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetPlayersByTeam = vi.fn();
const mockGetTeamInjuries = vi.fn();
const mockUpdatePlayerInjury = vi.fn();
vi.mock("../../../../services/teamplayerService", () => ({
  default: {
    getPlayersByTeam: (...args: unknown[]) => mockGetPlayersByTeam(...args),
  },
  getTeamInjuries: (...args: unknown[]) => mockGetTeamInjuries(...args),
  createPlayerInjury: vi.fn(),
  updatePlayerInjury: (...args: unknown[]) => mockUpdatePlayerInjury(...args),
}));

import InjuredPlayersList from "../InjuredPlayersList";

const team = { id: "team-1", name: "Equipo 1" };

function renderList(isCoach: boolean) {
  render(<InjuredPlayersList team={team} isCoach={isCoach} />);
}

describe("InjuredPlayersList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlayersByTeam.mockResolvedValue([
      { id: "tp-1", name: "Ana", lastName: "García", alias: "ana" },
    ]);
    mockGetTeamInjuries.mockResolvedValue([
      {
        teamPlayerId: "tp-1",
        injuries: [
          {
            id: "inj-1",
            startDate: "2026-01-01T00:00:00Z",
            injuryType: "Rotura fibrilar",
            endDate: null,
          },
        ],
      },
    ]);
  });

  it("nunca renderiza una tabla, usa tarjetas para mostrar las lesiones", async () => {
    renderList(true);

    await screen.findByText("Rotura fibrilar");

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("obtiene las lesiones de todo el equipo con una única llamada", async () => {
    renderList(true);

    await waitFor(() => expect(screen.getByText("Rotura fibrilar")).toBeInTheDocument());

    expect(mockGetTeamInjuries).toHaveBeenCalledTimes(1);
    expect(mockGetTeamInjuries).toHaveBeenCalledWith("team-1");
  });

  it("muestra un estado vacío cuando no hay lesiones registradas", async () => {
    mockGetTeamInjuries.mockResolvedValue([]);

    renderList(true);

    await waitFor(() =>
      expect(screen.getByText(/Sin lesiones registradas/i)).toBeInTheDocument()
    );
  });

  it("muestra las acciones de gestión solo para un coach", async () => {
    renderList(true);

    await screen.findByText("Rotura fibrilar");

    expect(
      screen.getByRole("button", { name: /añadir lesión/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^editar$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dar de alta/i })).toBeInTheDocument();
  });

  it("oculta las acciones de gestión para roles distintos de coach", async () => {
    renderList(false);

    await screen.findByText("Rotura fibrilar");

    expect(
      screen.queryByRole("button", { name: /añadir lesión/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^editar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dar de alta/i })).not.toBeInTheDocument();
  });

  it("dar de alta abre un ConfirmDialog y solo llama al servicio al confirmar", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    mockUpdatePlayerInjury.mockResolvedValue({ id: "inj-1" });

    renderList(true);
    await screen.findByText("Rotura fibrilar");

    await userEvent.click(screen.getByRole("button", { name: /dar de alta/i }));

    expect(await screen.findByText(/¿dar de alta a ana garcía\?/i)).toBeInTheDocument();
    expect(mockUpdatePlayerInjury).not.toHaveBeenCalled();

    const dialog = within(screen.getByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: /^dar de alta$/i }));

    await waitFor(() => expect(mockUpdatePlayerInjury).toHaveBeenCalledTimes(1));
  });
});
