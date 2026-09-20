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

function renderTab(notCalled: SquadPlayer[]) {
  render(
    <MemoryRouter>
      <AlineacionTab
        mgmtEventId="event-1"
        lineupPlayers={[{ id: "p1", displayName: "Jugador Uno", dorsal: 7 }]}
        notCalledPlayers={notCalled}
        lineupRef={createRef<IdealLineupHandle>()}
        teamId="team-1"
        onSavingChange={() => {}}
      />
    </MemoryRouter>,
  );
}

describe("AlineacionTab - Estado de forma del backend", () => {
  it("muestra en Ef el formStatus del backend para el jugador desconvocado", async () => {
    renderTab([{ id: "p2", displayName: "Jugador Dos", readiness: 90, fatigue: 8, formStatus: 33 }]);

    expect(await screen.findByText("Jugador Dos")).toBeInTheDocument();
    expect(screen.getByTestId("player-form-bar-ef")).toHaveTextContent("33%");
  });

  it("cae al cálculo local de Ef cuando no hay formStatus", async () => {
    renderTab([{ id: "p2", displayName: "Jugador Dos", readiness: 90, fatigue: 8 }]);

    expect(await screen.findByText("Jugador Dos")).toBeInTheDocument();
    expect(screen.getByTestId("player-form-bar-ef")).toHaveTextContent("86%");
  });
});
