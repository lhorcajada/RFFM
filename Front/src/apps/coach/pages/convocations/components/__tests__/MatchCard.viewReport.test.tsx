import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import MatchCard from "../MatchCard";
import AgendaList from "../AgendaList";
import type { NormalizedMatch } from "../../types";

function baseMatch(overrides: Partial<NormalizedMatch> = {}): NormalizedMatch {
  return {
    date: "2026-09-01",
    time: "18:00",
    localTeamName: "Team A",
    localTeamShield: "",
    localGoals: "2",
    visitorTeamName: "Team B",
    visitorTeamShield: "",
    visitorGoals: "1",
    isFinished: true,
    isHomeTeam: true,
    field: "",
    codacta: null,
    selectedKitNumber: null,
    locationMapUrl: null,
    eventId: "e1",
    matchCategory: "Friendly",
    ...overrides,
  };
}

describe("MatchCard - botón Ver acta", () => {
  it("en un partido finalizado con acta muestra «Ver acta» y abre el acta sin navegar a la ficha", async () => {
    const onNavigate = vi.fn();
    const onViewReport = vi.fn();
    const match = baseMatch();
    render(
      <MemoryRouter>
        <MatchCard match={match} onNavigate={onNavigate} onViewReport={onViewReport} />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Ver acta" }));

    expect(onViewReport).toHaveBeenCalledWith(match);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("sin acta disponible no muestra el botón", () => {
    render(
      <MemoryRouter>
        <MatchCard match={baseMatch()} onNavigate={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "Ver acta" })).not.toBeInTheDocument();
  });

  it("en un partido no finalizado no muestra el botón", () => {
    render(
      <MemoryRouter>
        <MatchCard match={baseMatch({ isFinished: false })} onNavigate={() => {}} onViewReport={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "Ver acta" })).not.toBeInTheDocument();
  });

  it("los jugadores y familiares también pueden ver el acta", () => {
    render(
      <MemoryRouter>
        <MatchCard match={baseMatch()} onNavigate={() => {}} onViewReport={() => {}} isPlayer />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Ver acta" })).toBeInTheDocument();
  });
});

describe("AgendaList - botón Ver acta", () => {
  it("solo muestra «Ver acta» en los partidos con acta disponible", () => {
    const withReport = baseMatch({ eventId: "e1", localTeamName: "Con acta" });
    const withoutReport = baseMatch({ eventId: "e2", localTeamName: "Sin acta" });

    render(
      <MemoryRouter>
        <AgendaList
          matches={[withReport, withoutReport]}
          onNavigate={() => {}}
          onViewReport={() => {}}
          hasReport={(m) => m.eventId === "e1"}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("button", { name: "Ver acta" })).toHaveLength(1);
  });
});
