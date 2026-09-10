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
    // Ef = readiness * (1 - fatigue / 200) = 90 * (1 - 8 / 200) = 86.4 → 86
    expect(screen.getByText("86%")).toBeInTheDocument();
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

    // Ef = readiness * (1 - fatigue / 200) = 60 * (1 - 15 / 200) = 55.5 → 56
    expect(await screen.findByText("56%")).toBeInTheDocument();
  });
});
