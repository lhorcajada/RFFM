import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ConvocationTab from "../ConvocationTab";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { DeconvokeProposal } from "../../utils/deconvokeProposal";

const players: PlayerResponse[] = [
  {
    id: "p1",
    name: "Jugador",
    lastName: "Uno",
    alias: null,
    dorsal: 9,
    position: "Delantero",
    isInjured: false,
  } as unknown as PlayerResponse,
];

const emptyProposal: DeconvokeProposal = {
  targetCount: 0,
  calledCount: 0,
  previousRivalResult: null,
  players: [],
};

describe("ConvocationTab - indicador Ef/Rodaje/Cansancio", () => {
  it("muestra las barras compactas Ef/R/C del jugador convocado", () => {
    render(
      <ConvocationTab
        mgmtEventId="event-1"
        mgmtLoadingConv={false}
        loadingPlayers={false}
        teamAvgRating={null}
        mgmtCalled={["p1"]}
        mgmtAvailable={[]}
        mgmtNotCalled={[]}
        players={players}
        mgmtRatings={{}}
        mgmtPhotos={{}}
        mgmtExcuseMap={{}}
        excuseTypes={[]}
        mgmtDragPlayer={null}
        mgmtDragOver={null}
        onDragStart={() => {}}
        onDragEnd={() => {}}
        onDragOver={() => {}}
        onDragLeave={() => {}}
        onDrop={() => {}}
        onExcuseChange={() => {}}
        proposal={emptyProposal}
        proposalLoading={false}
        onApplyProposal={async () => {}}
        onPrintProposal={async () => {}}
        readinessMap={{
          p1: { readiness: 65, fatigue: 22 },
        }}
      />,
    );

    // Ef = readiness * (1 - fatigue / 200) = 65 * (1 - 22 / 200) = 57.75 → 58
    expect(screen.getByTestId("player-form-bar-ef")).toHaveTextContent("Ef58%");
    expect(screen.getByTestId("player-form-bar-r")).toHaveTextContent("R65%");
    expect(screen.getByTestId("player-form-bar-c")).toHaveTextContent("C22%");
  });

  it("muestra una única leyenda consolidada de Ef, Rodaje y Cansancio", () => {
    render(
      <ConvocationTab
        mgmtEventId="event-1"
        mgmtLoadingConv={false}
        loadingPlayers={false}
        teamAvgRating={null}
        mgmtCalled={["p1"]}
        mgmtAvailable={[]}
        mgmtNotCalled={[]}
        players={players}
        mgmtRatings={{}}
        mgmtPhotos={{}}
        mgmtExcuseMap={{}}
        excuseTypes={[]}
        mgmtDragPlayer={null}
        mgmtDragOver={null}
        onDragStart={() => {}}
        onDragEnd={() => {}}
        onDragOver={() => {}}
        onDragLeave={() => {}}
        onDrop={() => {}}
        onExcuseChange={() => {}}
        proposal={emptyProposal}
        proposalLoading={false}
        onApplyProposal={async () => {}}
        onPrintProposal={async () => {}}
        readinessMap={{
          p1: { readiness: 65, fatigue: 22 },
        }}
      />,
    );

    const legends = screen.getAllByLabelText("Leyenda de Ef, Rodaje y Cansancio");
    expect(legends).toHaveLength(1);
  });
});
