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
  { id: "p1", displayName: "Jugador Uno", dorsal: 7, position: "Delantero", readiness: 60, fatigue: 15 },
];

const notCalledPlayers: SquadPlayer[] = [
  { id: "p2", displayName: "Jugador Dos", dorsal: 4, position: "Defensa", readiness: 90, fatigue: 8 },
];

describe("AlineacionTab - indicador Ef/Rodaje/Cansancio", () => {
  it("muestra las barras Ef/R/C del jugador desconvocado en el panel lateral", async () => {
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
    // Ef = max(0, min(100, 90 - 8)) = 82
    expect(screen.getByText("82%")).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByText("8%")).toBeInTheDocument();
  });

  it("muestra las barras Ef/R/C del jugador en la lista del banquillo", async () => {
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

    // Ef = max(0, min(100, 60 - 15)) = 45
    expect(await screen.findByText("45%")).toBeInTheDocument();
  });
});
