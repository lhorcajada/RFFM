import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("../PlayerSeasonsDetail", () => ({
  default: ({ playerId, season }: { playerId: string; season: string }) => (
    <div>detalle {playerId} {season}</div>
  ),
}));

import ComparedPlayerCard from "../ComparedPlayerCard";
import type { ComparedPlayer } from "../../../../services/squadComparisonService";

function player(overrides: Partial<ComparedPlayer> = {}): ComparedPlayer {
  return {
    name: "José Pérez",
    photoUrl: "https://cdn/foto.jpg",
    jerseyNumber: "10",
    rffmPlayerId: "1001",
    teamPlayerId: "tp1",
    status: "Licensed",
    stats: { called: 8, starter: 6, substitute: 2, played: 8, goals: 3, yellow: 1, red: 2, doubleYellow: 0 },
    ...overrides,
  };
}

describe("ComparedPlayerCard", () => {
  it("muestra el nombre y el dorsal del jugador", () => {
    render(<ComparedPlayerCard season="22" player={player()} />);

    expect(screen.getByText("José Pérez")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("muestra el tag Con ficha si el jugador aparece en la RFFM", () => {
    render(<ComparedPlayerCard season="22" player={player({ status: "Licensed" })} />);

    expect(screen.getByText("Con ficha")).toBeInTheDocument();
  });

  it("muestra el tag Sin ficha si el jugador no aparece en la RFFM", () => {
    render(<ComparedPlayerCard season="22" player={player({ status: "Unlicensed" })} />);

    expect(screen.getByText("Sin ficha")).toBeInTheDocument();
  });

  it("muestra el tag No está en el equipo si el jugador solo aparece en la RFFM", () => {
    render(<ComparedPlayerCard season="22" player={player({ status: "NotInTeam", teamPlayerId: null })} />);

    expect(screen.getByText("No está en el equipo")).toBeInTheDocument();
  });

  it("muestra la foto del jugador cuando la tiene", () => {
    render(<ComparedPlayerCard season="22" player={player()} />);

    expect(screen.getByRole("img", { name: "José Pérez" })).toHaveAttribute("src", "https://cdn/foto.jpg");
  });

  it("muestra las iniciales cuando el jugador no tiene foto", () => {
    render(<ComparedPlayerCard season="22" player={player({ photoUrl: null })} />);

    expect(screen.getByText("JP")).toBeInTheDocument();
  });

  it("indica sin dorsal cuando el jugador no lo tiene", () => {
    render(<ComparedPlayerCard season="22" player={player({ jerseyNumber: null })} />);

    expect(screen.getByText("–")).toBeInTheDocument();
  });

  it("muestra los goles y las tarjetas de la temporada", () => {
    render(<ComparedPlayerCard season="22" player={player()} />);

    expect(screen.getByLabelText("Goles")).toHaveTextContent("3");
    expect(screen.getByLabelText("Amarillas")).toHaveTextContent("1");
    expect(screen.getByLabelText("Rojas")).toHaveTextContent("2");
  });

  it("al desplegar muestra el detalle por temporadas del jugador", async () => {
    render(<ComparedPlayerCard season="22" player={player()} />);

    await userEvent.click(screen.getByRole("button", { name: /ver estadísticas/i }));

    expect(screen.getByText("detalle 1001 22")).toBeInTheDocument();
  });

  it("sin ficha RFFM no ofrece estadísticas", () => {
    render(
      <ComparedPlayerCard
        season="22"
        player={player({ status: "Unlicensed", rffmPlayerId: null, stats: null })}
      />,
    );

    expect(screen.queryByRole("button", { name: /ver estadísticas/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Goles")).not.toBeInTheDocument();
  });
});
