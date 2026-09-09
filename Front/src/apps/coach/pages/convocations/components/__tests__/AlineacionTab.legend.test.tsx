import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("AlineacionTab - leyenda única de Ef/Rodaje/Cansancio", () => {
  it("muestra una única leyenda consolidada explicando los colores de Ef, Rodaje y Cansancio", async () => {
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

    const legends = await screen.findAllByLabelText("Leyenda de Ef, Rodaje y Cansancio");
    expect(legends).toHaveLength(1);
  });
});
