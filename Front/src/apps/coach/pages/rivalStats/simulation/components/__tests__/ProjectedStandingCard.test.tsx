import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProjectedStandingCard from "../ProjectedStandingCard";
import type { ProjectedStanding } from "../../../../../services/rivalStatsService";

function standing(overrides: Partial<ProjectedStanding> = {}): ProjectedStanding {
  return {
    teamCode: "E1",
    teamName: "CD Propio",
    shieldUrl: null,
    currentPosition: 3,
    currentPoints: 12,
    expectedPoints: 41.6,
    mostLikelyPosition: 2,
    championProbability: 0.18,
    positionProbabilities: [0.18, 0.42, 0.25, 0.15],
    attack: 1.2,
    defense: 0.9,
    squadStrength: 1.1,
    ...overrides,
  };
}

describe("ProjectedStandingCard", () => {
  it("muestra el puesto proyectado y los puntos actuales y esperados", () => {
    render(<ProjectedStandingCard standing={standing()} projectedPosition={2} isOwnTeam={false} />);

    expect(screen.getByText("2º")).toBeInTheDocument();
    expect(screen.getByText("CD Propio")).toBeInTheDocument();
    expect(screen.getByText(/puntos/i).textContent).toContain("12 → 41,6");
  });

  it("muestra el puesto más probable con su probabilidad y la de ser campeón", () => {
    render(<ProjectedStandingCard standing={standing()} projectedPosition={2} isOwnTeam={false} />);

    expect(screen.getByText(/puesto más probable/i).textContent).toMatch(/2º.*42\s?%/);
    expect(screen.getByText(/campeón/i).textContent).toMatch(/18\s?%/);
  });

  it("resalta el propio equipo", () => {
    render(<ProjectedStandingCard standing={standing()} projectedPosition={2} isOwnTeam />);

    expect(screen.getByText("Tu equipo")).toBeInTheDocument();
  });

  it("muestra la distribución de probabilidades por puesto", () => {
    render(<ProjectedStandingCard standing={standing()} projectedPosition={2} isOwnTeam={false} />);

    expect(screen.getByRole("img", { name: /probabilidad por puesto/i })).toBeInTheDocument();
  });
});
