import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import PlayerCromo from "../PlayerCromo";
import type { LeaguePlayerStats } from "../../../../services/leagueStatsService";

const stats: LeaguePlayerStats = {
  teamPlayerId: "tp-1",
  goals: 7,
  callUps: 12,
  starts: 9,
  yellowCards: 3,
  redCards: 1,
  minutesPlayed: 810,
};

function renderCromo(leagueStats?: LeaguePlayerStats | null) {
  return render(
    <MemoryRouter>
      <PlayerCromo displayName="Juan Pérez" leagueStats={leagueStats} />
    </MemoryRouter>
  );
}

describe("PlayerCromo — bloque «Solo liga»", () => {
  it("etiqueta el bloque como solo liga", () => {
    renderCromo(stats);

    expect(screen.getByText("Solo liga")).toBeInTheDocument();
  });

  it.each([
    ["Goles", "7"],
    ["Convocatorias", "12"],
    ["Titular", "9"],
    ["Amarillas", "3"],
    ["Rojas", "1"],
    ["Minutos", "810"],
  ])("muestra %s con su valor", (label, value) => {
    renderCromo(stats);

    const item = screen.getByText(label).parentElement as HTMLElement;
    expect(within(item).getByText(value)).toBeInTheDocument();
  });

  it("muestra los ceros cuando el jugador no tiene datos de liga", () => {
    renderCromo({ ...stats, goals: 0, callUps: 0, starts: 0, yellowCards: 0, redCards: 0, minutesPlayed: 0 });

    expect(screen.getByText("Solo liga")).toBeInTheDocument();
    expect(screen.getAllByText("0")).toHaveLength(6);
  });

  it("no muestra el bloque sin datos de liga", () => {
    renderCromo(null);

    expect(screen.queryByText("Solo liga")).not.toBeInTheDocument();
  });
});
