import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => ["Coach"],
  },
}));

import AttendanceTrainingsTab from "../AttendanceTrainingsTab";
import type { PlayerTrainingSummary } from "../types";

function makeRow(overrides: Partial<PlayerTrainingSummary> = {}): PlayerTrainingSummary {
  return {
    playerId: "player-1",
    teamPlayerId: "tp-1",
    playerName: "Jugador Uno",
    photoUrl: null,
    totalTrainings: 4,
    attendedTrainings: 3,
    absentTrainings: 1,
    absences: [],
    ...overrides,
  };
}

describe("AttendanceTrainingsTab — totales posibles y porcentaje de asistencia", () => {
  it("no muestra ningún dato de pendientes", () => {
    render(<AttendanceTrainingsTab rows={[makeRow()]} />);

    expect(screen.queryByText(/pendiente/i)).not.toBeInTheDocument();
  });

  it("muestra el total de entrenamientos posibles (no el total de eventos del equipo)", () => {
    render(<AttendanceTrainingsTab rows={[makeRow({ totalTrainings: 4 })]} />);

    expect(screen.getByText("4 posibles")).toBeInTheDocument();
  });

  it("muestra el porcentaje de asistencia respecto al total posible", () => {
    // attended: 3, total posible: 4 -> 75%
    render(<AttendanceTrainingsTab rows={[makeRow({ attendedTrainings: 3, totalTrainings: 4 })]} />);

    expect(screen.getByText("75% asistencia")).toBeInTheDocument();
  });
});
