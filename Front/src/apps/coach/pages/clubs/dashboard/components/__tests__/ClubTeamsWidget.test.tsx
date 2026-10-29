import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

const getTeams = vi.hoisted(() => vi.fn());

vi.mock("../../../../../services/teamService", () => ({
  default: { getTeams },
}));

import ClubTeamsWidget from "../ClubTeamsWidget";

const renderWidget = (seasonId?: string) =>
  render(
    <MemoryRouter>
      <ClubTeamsWidget clubId="club-1" seasonId={seasonId} />
    </MemoryRouter>,
  );

describe("ClubTeamsWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lista cada equipo con su categoría y enlace a su panel", async () => {
    getTeams.mockResolvedValue([
      { id: "t-1", name: "Infantil A", category: { id: 1, name: "Infantil" } },
      { id: "t-2", name: "Cadete B", category: { id: 2, name: "Cadete" } },
    ]);

    renderWidget("s-9");

    const link = await screen.findByRole("link", { name: /Infantil A/ });
    expect(link).toHaveAttribute("href", "/coach/team-dashboard?teamId=t-1");
    expect(link).toHaveTextContent("Infantil");
    expect(getTeams).toHaveBeenCalledWith("club-1", "s-9");
    expect(screen.getByRole("link", { name: "Ver todos" })).toHaveAttribute(
      "href",
      "/coach/clubs/club-1/teams?seasonId=s-9",
    );
  });

  it("avisa de que el club no tiene equipos", async () => {
    getTeams.mockResolvedValue([]);

    renderWidget();

    expect(await screen.findByText("El club no tiene equipos")).toBeInTheDocument();
  });

  it("muestra un error si no se pueden cargar los equipos", async () => {
    getTeams.mockRejectedValue(new Error("boom"));

    renderWidget();

    expect(await screen.findByText("No se pudieron cargar los equipos")).toBeInTheDocument();
  });

  it("muestra el indicador de carga mientras espera", () => {
    getTeams.mockReturnValue(new Promise(() => {}));

    renderWidget();

    expect(screen.getByRole("progressbar", { name: "Cargando equipos" })).toBeInTheDocument();
  });
});
