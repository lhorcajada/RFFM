import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PlayerSeasonStats, { type PlayerSeason } from "../PlayerSeasonStats";

function season(seasonId: number, seasonName: string, overrides: Partial<PlayerSeason["stats"]> = {}): PlayerSeason {
  return {
    seasonId,
    seasonName,
    stats: { called: 10, starter: 8, substitute: 2, played: 9, goals: 4, yellow: 3, red: 1, doubleYellow: 1, ...overrides },
    teams: [
      { competitionName: "Liga Infantil", groupName: "Grupo 2", teamName: `CD Ejemplo ${seasonName}`, teamPoints: 30, teamPosition: 2 },
    ],
  };
}

describe("PlayerSeasonStats", () => {
  it("muestra una sección por temporada con su título", () => {
    render(<PlayerSeasonStats seasons={[season(22, "2026-2027"), season(21, "2025-2026")]} />);

    expect(screen.getByRole("region", { name: "Temporada 2026-2027" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Temporada 2025-2026" })).toBeInTheDocument();
  });

  it("muestra los totales de la temporada con etiquetas accesibles", () => {
    render(<PlayerSeasonStats seasons={[season(22, "2026-2027")]} />);

    const region = screen.getByRole("region", { name: "Temporada 2026-2027" });
    expect(within(region).getByLabelText("Convocatorias")).toHaveTextContent("10");
    expect(within(region).getByLabelText("Titularidades")).toHaveTextContent("8");
    expect(within(region).getByLabelText("Suplencias")).toHaveTextContent("2");
    expect(within(region).getByLabelText("Partidos jugados")).toHaveTextContent("9");
    expect(within(region).getByLabelText("Goles")).toHaveTextContent("4");
    expect(within(region).getByLabelText("Amarillas")).toHaveTextContent("3");
  });

  it("suma las dobles amarillas a las rojas", () => {
    render(<PlayerSeasonStats seasons={[season(22, "2026-2027", { red: 1, doubleYellow: 2 })]} />);

    expect(screen.getByLabelText("Rojas")).toHaveTextContent("3");
  });

  it("muestra los equipos de la temporada con sus puntos y posición", () => {
    render(<PlayerSeasonStats seasons={[season(22, "2026-2027")]} />);

    expect(screen.getByText("CD Ejemplo 2026-2027")).toBeInTheDocument();
    expect(screen.getByText("Liga Infantil · Grupo 2")).toBeInTheDocument();
    expect(screen.getByText("30 pts")).toBeInTheDocument();
    expect(screen.getByText("2º")).toBeInTheDocument();
  });

  it("no muestra la posición cuando el equipo no la tiene", () => {
    const withoutPosition = season(22, "2026-2027");
    withoutPosition.teams[0].teamPosition = 0;

    render(<PlayerSeasonStats seasons={[withoutPosition]} />);

    expect(screen.queryByText(/º$/)).not.toBeInTheDocument();
  });
});
