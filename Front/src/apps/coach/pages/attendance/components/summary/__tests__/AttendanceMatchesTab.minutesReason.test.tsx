import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import AttendanceMatchesTab from "../AttendanceMatchesTab";
import type { MatchAttendanceColumn, PlayerMatchSummary } from "../types";

const officialColumn: MatchAttendanceColumn = {
  eventId: "event-1",
  label: "J1",
  date: "2026-01-01T10:00:00Z",
  rival: "Rival A",
  isFriendly: false,
};

function makeRow(overrides: Partial<PlayerMatchSummary> = {}): PlayerMatchSummary {
  return {
    playerId: "tp-1",
    playerName: "Jugador Uno",
    totalMatches: 1,
    calledMatches: 1,
    startedMatches: 1,
    notCalledMatches: 0,
    technicalDecisionMatches: 0,
    unavailableMatches: 0,
    injuryMatches: 0,
    illnessMatches: 0,
    seasonMinutesPlayed: 78,
    cells: [
      {
        eventId: "event-1",
        state: "starter",
        wasCalled: true,
        wasStarter: true,
        minutesPlayed: 78,
        minutesReason: "Vuelta de vacaciones",
      },
    ],
    ...overrides,
  };
}

async function expandCard(playerName: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: new RegExp(playerName, "i") }));
}

describe("AttendanceMatchesTab — motivo de minutos (solo lectura)", () => {
  it("muestra un icono con el motivo de minutos en la fila de detalle cuando hay uno guardado", async () => {
    render(<AttendanceMatchesTab rows={[makeRow()]} columns={[officialColumn]} />);

    await expandCard("Jugador Uno");

    expect(screen.getByLabelText(/motivo de minutos: vuelta de vacaciones/i)).toBeInTheDocument();
  });

  it("no muestra ningún icono de motivo cuando no hay ninguno guardado", async () => {
    const row = makeRow({
      cells: [
        {
          eventId: "event-1",
          state: "starter",
          wasCalled: true,
          wasStarter: true,
          minutesPlayed: 78,
          minutesReason: null,
        },
      ],
    });
    render(<AttendanceMatchesTab rows={[row]} columns={[officialColumn]} />);

    await expandCard("Jugador Uno");

    expect(screen.queryByLabelText(/motivo de minutos/i)).not.toBeInTheDocument();
  });
});
