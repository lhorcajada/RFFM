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

function renderTab() {
  const ref = createRef<IdealLineupHandle>();
  return render(
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
}

describe("AlineacionTab — motivo de minutos (pre-partido)", () => {
  it("no renderiza ningún control de motivos de minutos — el botón único vive en la barra de acciones", async () => {
    renderTab();

    await screen.findByText("Jugador Uno");
    expect(screen.queryByRole("button", { name: /motivos de minutos/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Motivos de minutos")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
