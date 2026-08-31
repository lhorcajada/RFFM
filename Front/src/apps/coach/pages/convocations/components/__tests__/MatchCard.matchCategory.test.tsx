import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import MatchCard from "../MatchCard";
import type { NormalizedMatch } from "../../types";

function baseMatch(overrides: Partial<NormalizedMatch> = {}): NormalizedMatch {
  return {
    date: "2026-09-01",
    time: "18:00",
    localTeamName: "Team A",
    localTeamShield: "",
    localGoals: null,
    visitorTeamName: "Team B",
    visitorTeamShield: "",
    visitorGoals: null,
    isFinished: false,
    isHomeTeam: true,
    field: "Field 1",
    codacta: null,
    selectedKitNumber: null,
    matchCategory: null,
    ...overrides,
  };
}

function renderCard(match: NormalizedMatch) {
  return render(
    <MemoryRouter>
      <MatchCard match={match} onNavigate={() => {}} />
    </MemoryRouter>
  );
}

describe("MatchCard - indicador de categoría de partido", () => {
  it("muestra la etiqueta Liga para un partido de liga", () => {
    renderCard(baseMatch({ matchCategory: "League" }));
    expect(screen.getByText(/liga/i)).toBeInTheDocument();
  });

  it("muestra la etiqueta Amistoso para un partido amistoso", () => {
    renderCard(baseMatch({ matchCategory: "Friendly" }));
    expect(screen.getByText(/amistoso/i)).toBeInTheDocument();
  });

  it("muestra la etiqueta Torneo para un partido de torneo", () => {
    renderCard(baseMatch({ matchCategory: "Tournament" }));
    expect(screen.getByText(/torneo/i)).toBeInTheDocument();
  });

  it("usa distintas clases de color para cada categoría", () => {
    const { container: leagueContainer } = renderCard(baseMatch({ matchCategory: "League" }));
    const leagueChip = leagueContainer.querySelector('[class*="categoryChip"]');
    expect(leagueChip).toBeTruthy();

    const { container: friendlyContainer } = renderCard(baseMatch({ matchCategory: "Friendly" }));
    const friendlyChip = friendlyContainer.querySelector('[class*="categoryChip"]');
    expect(friendlyChip).toBeTruthy();
    expect(friendlyChip?.className).not.toBe(leagueChip?.className);

    const { container: tournamentContainer } = renderCard(baseMatch({ matchCategory: "Tournament" }));
    const tournamentChip = tournamentContainer.querySelector('[class*="categoryChip"]');
    expect(tournamentChip).toBeTruthy();
    expect(tournamentChip?.className).not.toBe(friendlyChip?.className);
  });

  it("no muestra etiqueta de categoría cuando matchCategory es null", () => {
    renderCard(baseMatch({ matchCategory: null }));
    expect(screen.queryByText(/liga|amistoso|torneo/i)).not.toBeInTheDocument();
  });
});
