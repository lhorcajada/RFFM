import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MatchPredictionCard from "../MatchPredictionCard";
import type { MatchPrediction } from "../../../../../services/rivalStatsService";

function prediction(overrides: Partial<MatchPrediction> = {}): MatchPrediction {
  return {
    round: 5,
    date: "2026-11-08",
    localTeamCode: "E1",
    localTeamName: "CD Propio",
    localShieldUrl: null,
    visitorTeamCode: "E2",
    visitorTeamName: "AD Rival",
    visitorShieldUrl: null,
    localWinProbability: 0.5,
    drawProbability: 0.3,
    visitorWinProbability: 0.2,
    localExpectedGoals: 1.8,
    visitorExpectedGoals: 0.9,
    mostLikelyLocalGoals: 1,
    mostLikelyVisitorGoals: 0,
    ...overrides,
  };
}

describe("MatchPredictionCard", () => {
  it("muestra los dos equipos y las probabilidades de cada resultado", () => {
    render(<MatchPredictionCard prediction={prediction()} ownTeamCode={null} />);

    expect(screen.getByText("CD Propio")).toBeInTheDocument();
    expect(screen.getByText("AD Rival")).toBeInTheDocument();
    expect(screen.getByText(/gana local/i).textContent).toMatch(/50\s?%/);
    expect(screen.getByText(/empate/i).textContent).toMatch(/30\s?%/);
    expect(screen.getByText(/gana visitante/i).textContent).toMatch(/20\s?%/);
  });

  it("muestra el marcador más probable y los goles esperados", () => {
    render(<MatchPredictionCard prediction={prediction()} ownTeamCode={null} />);

    expect(screen.getByText(/marcador más probable/i).textContent).toContain("1 - 0");
    expect(screen.getByText(/goles esperados/i).textContent).toContain("1,8 - 0,9");
  });

  it("marca el partido del propio equipo", () => {
    render(<MatchPredictionCard prediction={prediction()} ownTeamCode="E2" />);

    expect(screen.getByText("Tu equipo")).toBeInTheDocument();
  });
});
