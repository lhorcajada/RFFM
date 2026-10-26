import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import EventCard from "../EventCard";
import type { SportEventResponse } from "../../../services/sportEventService";

function matchEvent(overrides: Partial<SportEventResponse> = {}): SportEventResponse {
  return {
    id: "match-1",
    title: "Partido",
    startTime: "2026-10-31T10:30:00",
    teamId: "team-1",
    teamName: "Mi equipo",
    rivalName: "CD Vallecas",
    isHomeMatch: true,
    ...overrides,
  };
}

function renderMatch(event: SportEventResponse) {
  return render(
    <MemoryRouter>
      <EventCard event={event} eventTypeName="Partido" />
    </MemoryRouter>
  );
}

describe("EventCard — partidos", () => {
  it("muestra «vs» y la hora de inicio cuando no hay marcador", () => {
    renderMatch(matchEvent());
    expect(screen.getByText("vs")).toBeInTheDocument();
    expect(screen.getAllByText("10:30").length).toBeGreaterThan(0);
  });

  it("muestra el marcador y «Victoria» cuando el equipo local gana jugando en casa", () => {
    renderMatch(matchEvent({ localGoals: "3", visitorGoals: "1" }));
    expect(screen.getByText("3 – 1")).toBeInTheDocument();
    expect(screen.getByText("Victoria")).toBeInTheDocument();
  });

  it("muestra «Derrota» cuando el equipo pierde jugando de visitante", () => {
    renderMatch(matchEvent({ isHomeMatch: false, localGoals: "3", visitorGoals: "1" }));
    expect(screen.getByText("Derrota")).toBeInTheDocument();
  });

  it("muestra «Empate» con el marcador igualado", () => {
    renderMatch(matchEvent({ localGoals: "2", visitorGoals: "2" }));
    expect(screen.getByText("Empate")).toBeInTheDocument();
  });

  it("coloca al rival a la izquierda cuando el equipo juega de visitante", () => {
    renderMatch(matchEvent({ isHomeMatch: false }));
    const names = screen.getAllByTestId("match-team-name").map((el) => el.textContent);
    expect(names).toEqual(["CD Vallecas", "Mi equipo"]);
  });

  it("indica si el partido es local o visitante", () => {
    renderMatch(matchEvent({ isHomeMatch: false }));
    expect(screen.getByText("Visitante")).toBeInTheDocument();
  });
});
