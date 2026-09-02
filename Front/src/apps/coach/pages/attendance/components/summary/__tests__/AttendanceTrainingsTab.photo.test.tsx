import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => ["Coach"],
  },
}));

import AttendanceTrainingsTab from "../AttendanceTrainingsTab";
import type { PlayerTrainingSummary } from "../types";

function makeRow(overrides: Partial<PlayerTrainingSummary>): PlayerTrainingSummary {
  return {
    playerId: "player-1",
    teamPlayerId: "tp-1",
    playerName: "Jugador Uno",
    photoUrl: null,
    totalTrainings: 3,
    attendedTrainings: 2,
    absentTrainings: 1,
    absences: [],
    ...overrides,
  };
}

describe("AttendanceTrainingsTab — foto del jugador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra la foto del jugador cuando photoUrl está disponible", () => {
    render(<AttendanceTrainingsTab rows={[makeRow({ photoUrl: "blob:mock-photo" })]} />);

    const avatar = screen.getByAltText("Jugador Uno");
    expect(avatar).toHaveAttribute("src", "blob:mock-photo");
  });

  it("muestra las iniciales del jugador cuando no hay photoUrl", () => {
    render(<AttendanceTrainingsTab rows={[makeRow({ photoUrl: null, playerName: "Ana García" })]} />);

    expect(screen.getByText("AG")).toBeInTheDocument();
  });

  it("muestra la camiseta azul con el dorsal para un jugador de campo", () => {
    render(<AttendanceTrainingsTab rows={[makeRow({ dorsal: 4, position: "Defensa" })]} />);

    const jersey = screen.getByTitle("Dorsal 4").querySelector("svg");
    expect(jersey?.getAttribute("class")).not.toMatch(/matchDorsalJerseyKeeper/);
  });

  it("muestra la camiseta roja con el dorsal para un portero", () => {
    render(<AttendanceTrainingsTab rows={[makeRow({ dorsal: 1, position: "Portero" })]} />);

    const jersey = screen.getByTitle("Dorsal 1").querySelector("svg");
    expect(jersey?.getAttribute("class")).toMatch(/matchDorsalJerseyKeeper/);
  });

  it("no muestra insignia de dorsal cuando no está disponible", () => {
    render(<AttendanceTrainingsTab rows={[makeRow({ dorsal: null })]} />);

    expect(screen.queryByTitle(/^Dorsal/)).not.toBeInTheDocument();
  });
});
