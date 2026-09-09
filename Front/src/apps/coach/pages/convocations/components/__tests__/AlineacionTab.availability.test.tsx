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
  { id: "p1", displayName: "Jugador Uno", dorsal: 7, position: "Delantero", availability: 45, physicalFitness: 60, fatigue: 15 },
];

const notCalledPlayers: SquadPlayer[] = [
  { id: "p2", displayName: "Jugador Dos", dorsal: 4, position: "Defensa", availability: 82, physicalFitness: 90, fatigue: 8 },
];

describe("AlineacionTab - indicador de disponibilidad", () => {
  it("muestra la disponibilidad del jugador desconvocado en el panel lateral", async () => {
    const ref = createRef<IdealLineupHandle>();
    render(
      <MemoryRouter>
        <AlineacionTab
          mgmtEventId="event-1"
          lineupPlayers={lineupPlayers}
          notCalledPlayers={notCalledPlayers}
          lineupRef={ref}
          teamId="team-1"
          onSavingChange={() => {}}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Jugador Dos")).toBeInTheDocument();
    expect(screen.getByText("82%")).toBeInTheDocument();
  });

  it("muestra la disponibilidad del jugador en la lista del banquillo", async () => {
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

    expect(await screen.findByText("45%")).toBeInTheDocument();
  });

  it("muestra una leyenda visible explicando los colores de Disponibilidad", async () => {
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

    expect(await screen.findByText("Disponibilidad")).toBeInTheDocument();
    const availabilityLegend = screen.getByLabelText("Leyenda de Disponibilidad");
    expect(within(availabilityLegend).getByText("≥80")).toBeInTheDocument();
    expect(within(availabilityLegend).getByText("50-79")).toBeInTheDocument();
    expect(within(availabilityLegend).getByText("<50")).toBeInTheDocument();
  });
});
