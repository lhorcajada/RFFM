import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const getRolesMock = vi.fn();
vi.mock("../../../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => getRolesMock(),
  },
}));

import AttendanceTrainingsTab from "../AttendanceTrainingsTab";
import type { PlayerTrainingSummary } from "../types";

const rows: PlayerTrainingSummary[] = [
  {
    playerId: "player-1",
    teamPlayerId: "tp-1",
    playerName: "Jugador Uno",
    totalTrainings: 3,
    attendedTrainings: 2,
    absentTrainings: 1,
    absences: [],
  },
];

describe("AttendanceTrainingsTab — botón Exportar Excel según rol", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el botón Exportar Excel para un entrenador", () => {
    getRolesMock.mockReturnValue(["Coach"]);
    render(<AttendanceTrainingsTab rows={rows} />);
    expect(screen.getByRole("button", { name: /exportar excel/i })).toBeInTheDocument();
  });

  it("no muestra el botón Exportar Excel para un jugador", () => {
    getRolesMock.mockReturnValue(["Player"]);
    render(<AttendanceTrainingsTab rows={rows} />);
    expect(screen.queryByRole("button", { name: /exportar excel/i })).not.toBeInTheDocument();
  });

  it("no muestra el botón Exportar Excel para un familiar", () => {
    getRolesMock.mockReturnValue(["FamilyPlayer"]);
    render(<AttendanceTrainingsTab rows={rows} />);
    expect(screen.queryByRole("button", { name: /exportar excel/i })).not.toBeInTheDocument();
  });
});
