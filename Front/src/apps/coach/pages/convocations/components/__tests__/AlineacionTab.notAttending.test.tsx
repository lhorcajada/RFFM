import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { createRef } from "react";
import AlineacionTab from "../AlineacionTab";
import type { IdealLineupHandle, SquadPlayer } from "../../../squad/components/IdealLineup";

vi.mock("../../../../services/formationService", () => ({
  getFormations: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../../services/idealLineupService", () => ({
  getIdealLineup: vi.fn().mockResolvedValue(null),
  saveIdealLineup: vi.fn(),
}));

const lineupPlayers: SquadPlayer[] = [
  { id: "p1", displayName: "Jugador Uno", dorsal: 7, position: "Delantero", readiness: 72, fatigue: 20 },
];

describe("AlineacionTab - sección 'No asisten'", () => {
  it("muestra a los jugadores que no asistieron en una sección separada de Desconvocados, con el motivo", async () => {
    const ref = createRef<IdealLineupHandle>();
    const notAttendingPlayers: SquadPlayer[] = [
      {
        id: "p2",
        displayName: "Jugador Ausente",
        dorsal: 9,
        position: "Centrocampista",
        assistanceTypeId: 2,
        excuseReasonName: "Lesión",
      },
    ];

    render(
      <MemoryRouter>
        <AlineacionTab
          mgmtEventId="event-1"
          lineupPlayers={lineupPlayers}
          notAttendingPlayers={notAttendingPlayers}
          lineupRef={ref}
          teamId="team-1"
          onSavingChange={() => {}}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("No asisten")).toBeInTheDocument();
    expect(screen.getByText("Jugador Ausente")).toBeInTheDocument();
    expect(screen.getByText("No asistió (justificado) · Lesión")).toBeInTheDocument();
  });

  it("no muestra la sección 'No asisten' cuando no hay jugadores ausentes", async () => {
    const ref = createRef<IdealLineupHandle>();
    render(
      <MemoryRouter>
        <AlineacionTab
          mgmtEventId="event-1"
          lineupPlayers={lineupPlayers}
          lineupRef={ref}
          teamId="team-1"
          onSavingChange={() => {}}
        />
      </MemoryRouter>,
    );

    await screen.findByText("Desconvocados");
    expect(screen.queryByText("No asisten")).not.toBeInTheDocument();
  });

  it("el jugador no asistente no aparece duplicado en Desconvocados", async () => {
    const ref = createRef<IdealLineupHandle>();
    const notAttendingPlayers: SquadPlayer[] = [
      { id: "p2", displayName: "Jugador Ausente", dorsal: 9, assistanceTypeId: 3 },
    ];

    render(
      <MemoryRouter>
        <AlineacionTab
          mgmtEventId="event-1"
          lineupPlayers={lineupPlayers}
          notCalledPlayers={[]}
          notAttendingPlayers={notAttendingPlayers}
          lineupRef={ref}
          teamId="team-1"
          onSavingChange={() => {}}
        />
      </MemoryRouter>,
    );

    const desconvocadosHeading = await screen.findByText("Desconvocados");
    const desconvocadosPanel = desconvocadosHeading.closest("div")?.parentElement as HTMLElement;
    expect(within(desconvocadosPanel).getByText("Ninguno")).toBeInTheDocument();
  });
});
