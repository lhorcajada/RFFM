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
  { id: "p1", displayName: "Jugador Uno", dorsal: 7, position: "Delantero", readiness: 72 },
];

describe("AlineacionTab - leyenda de rodaje", () => {
  it("muestra una leyenda visible explicando los colores de Rodaje", async () => {
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

    expect(await screen.findByText("Rodaje")).toBeInTheDocument();
    const readinessLegend = screen.getByLabelText("Leyenda de Rodaje");
    expect(within(readinessLegend).getByText("≥80")).toBeInTheDocument();
    expect(within(readinessLegend).getByText("50-79")).toBeInTheDocument();
    expect(within(readinessLegend).getByText("<50")).toBeInTheDocument();
    expect(within(readinessLegend).getByText("Sin datos")).toBeInTheDocument();
  });
});
