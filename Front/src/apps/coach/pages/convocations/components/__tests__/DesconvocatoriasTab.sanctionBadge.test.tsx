import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DesconvocatoriasTab from "../DesconvocatoriasTab";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { GridCell, MatchColumn } from "../convocationMatchDetail.types";

const players: PlayerResponse[] = [
  { id: "p1", name: "Jugador", lastName: "Uno", alias: null, dorsal: 9 } as unknown as PlayerResponse,
  { id: "p2", name: "Jugador", lastName: "Dos", alias: null, dorsal: 10 } as unknown as PlayerResponse,
];

const matchColumns: MatchColumn[] = [
  { eventId: "e1", label: "J1", date: "2026-01-01", rival: "Rival A" },
];

function buildGrid(cellsByPlayer: Record<string, GridCell>): Map<string, Map<string, GridCell>> {
  const perEvent = new Map<string, GridCell>();
  for (const [playerId, cell] of Object.entries(cellsByPlayer)) {
    perEvent.set(playerId, cell);
  }
  return new Map([["e1", perEvent]]);
}

describe("DesconvocatoriasTab - insignia de sanción deportiva", () => {
  it("muestra una insignia distinta cuando la desconvocatoria tiene excuseTypeId === 8", () => {
    const enrichedGrid = buildGrid({
      p1: { statusId: 5, excuseTypeId: 8, statusName: "Deconvoke", excuseName: "Sanción deportiva" },
    });

    render(
      <DesconvocatoriasTab
        players={players}
        matchColumns={matchColumns}
        enrichedGrid={enrichedGrid}
        isLoading={false}
        teamId="team-1"
      />,
    );

    expect(screen.getByTitle(/desconvocado por sanción deportiva/i)).toBeInTheDocument();
  });

  it("no muestra la insignia de sanción para una desconvocatoria por otro motivo", () => {
    const enrichedGrid = buildGrid({
      p1: { statusId: 5, excuseTypeId: 7, statusName: "Deconvoke", excuseName: "Decisión técnica" },
    });

    render(
      <DesconvocatoriasTab
        players={players}
        matchColumns={matchColumns}
        enrichedGrid={enrichedGrid}
        isLoading={false}
        teamId="team-1"
      />,
    );

    expect(screen.queryByTitle(/desconvocado por sanción deportiva/i)).not.toBeInTheDocument();
  });
});
