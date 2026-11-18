import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getTeamLatestTraitRatings = vi.hoisted(() => vi.fn());
const getRatingConfig = vi.hoisted(() => vi.fn());

vi.mock("../../../../services/traitRatingService", () => ({ getTeamLatestTraitRatings }));
vi.mock("../../../../services/ratingConfigService", () => ({ getRatingConfig }));

import SquadRatings from "../SquadRatings";
import type { PlayerRating } from "../../../../types/playerRating";

const players = [
  { teamPlayerId: "p1", displayName: "Ana Portera", position: "Portero" },
  { teamPlayerId: "p2", displayName: "Beto Defensa", position: "Defensa" },
  { teamPlayerId: "p3", displayName: "Carlos Defensa", position: "Defensa" },
  { teamPlayerId: "p4", displayName: "Dani Delantero", position: "Delantero" },
];

function rating(teamPlayerId: string, physical: number): PlayerRating {
  return {
    id: `r-${teamPlayerId}`,
    teamPlayerId,
    isGoalkeeper: false,
    physical,
    technical: 5,
    tactical: 5,
    competitiveness: 5,
    ratedAt: "2026-11-01T00:00:00Z",
    answers: [],
  };
}

const latestRatings = { p2: rating("p2", 4), p3: rating("p3", 9) };

function conduct(teamPlayerId: string, trend: "up" | "same" | "down", pressing: number) {
  return {
    id: `c-${teamPlayerId}`,
    teamPlayerId,
    ratedAt: "2026-11-02T00:00:00Z",
    trend,
    levels: [{ traitKey: "traitPressing", level: pressing }],
  };
}

function renderTab(readOnly = false) {
  render(
    <MemoryRouter>
      <SquadRatings teamId="team-1" players={players} latestRatings={latestRatings} readOnly={readOnly} teamName="Equipo" />
    </MemoryRouter>,
  );
}

describe("SquadRatings — filtros de conducta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRatingConfig.mockResolvedValue({ capacities: [], traits: [] });
    getTeamLatestTraitRatings.mockResolvedValue([
      conduct("p2", "down", 2),
      conduct("p3", "up", 4),
      conduct("p4", "same", 1),
    ]);
  });

  it("filtra por rasgo y nivel manteniendo los grupos por posición y ocultando los vacíos", async () => {
    renderTab();
    await waitFor(() => expect(getTeamLatestTraitRatings).toHaveBeenCalled());
    await screen.findByLabelText("Rasgo");

    await userEvent.selectOptions(screen.getByLabelText("Rasgo"), "traitPressing");
    await userEvent.selectOptions(screen.getByLabelText("Nivel máx."), "2");

    await waitFor(() => expect(screen.queryByText("Carlos Defensa")).not.toBeInTheDocument());
    expect(screen.getByText("Beto Defensa")).toBeInTheDocument();
    expect(screen.getByText("Dani Delantero")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Portero" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Defensa" })).toBeInTheDocument();
  });

  it("filtra por tendencia", async () => {
    renderTab();
    await screen.findByLabelText("Rasgo");

    await userEvent.click(screen.getByRole("button", { name: "Subiendo" }));

    expect(screen.getByText("Carlos Defensa")).toBeInTheDocument();
    expect(screen.queryByText("Beto Defensa")).not.toBeInTheDocument();
    expect(screen.queryByText("Dani Delantero")).not.toBeInTheDocument();
  });

  it("los chips de orden siguen aplicando dentro del grupo filtrado", async () => {
    renderTab();
    await screen.findByLabelText("Rasgo");
    await userEvent.selectOptions(screen.getByLabelText("Rasgo"), "traitPressing");

    await userEvent.click(screen.getByRole("button", { name: "Físico" }));

    const defensa = screen.getByRole("region", { name: "Defensa" });
    const text = defensa.textContent ?? "";
    expect(text.indexOf("Carlos Defensa")).toBeLessThan(text.indexOf("Beto Defensa"));
  });

  it("sin coincidencias muestra un aviso y «Quitar filtros» vuelve a listar a todos", async () => {
    renderTab();
    await screen.findByLabelText("Rasgo");
    await userEvent.selectOptions(screen.getByLabelText("Rasgo"), "traitPressing");
    await userEvent.selectOptions(screen.getByLabelText("Nivel mín."), "5");

    expect(await screen.findByText("Ningún jugador coincide con los filtros de conducta.")).toBeInTheDocument();

    const clearButtons = screen.getAllByRole("button", { name: "Quitar filtros" });
    await userEvent.click(clearButtons[0]);

    expect(screen.getByText("Ana Portera")).toBeInTheDocument();
    expect(screen.getByText("Carlos Defensa")).toBeInTheDocument();
  });

  it("en solo lectura no muestra los filtros ni pide datos de conducta", async () => {
    renderTab(true);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByLabelText("Rasgo")).not.toBeInTheDocument();
    expect(getTeamLatestTraitRatings).not.toHaveBeenCalled();
    expect(getRatingConfig).not.toHaveBeenCalled();
    expect(screen.getByText("Ana Portera")).toBeInTheDocument();
  });

  it("si falla la lectura de conducta la pestaña sigue mostrando a todos", async () => {
    getTeamLatestTraitRatings.mockRejectedValue(new Error("403"));
    renderTab();

    await waitFor(() => expect(getTeamLatestTraitRatings).toHaveBeenCalled());

    expect(screen.getByText("Ana Portera")).toBeInTheDocument();
    expect(screen.getByText("Carlos Defensa")).toBeInTheDocument();
  });
});
