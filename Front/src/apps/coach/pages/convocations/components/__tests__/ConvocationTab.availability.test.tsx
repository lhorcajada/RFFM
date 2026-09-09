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
  it("muestra las barras Ef/R/C del jugador convocado, con etiqueta de texto completa", () => {
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
          p1: { readiness: 65, availability: 33, physicalFitness: 55, fatigue: 22 },
        }}
      />,
    );

    // Ef = max(0, min(100, 65 - 22)) = 43
    expect(screen.getByText("Ef")).toBeInTheDocument();
    expect(screen.getByText("Rodaje")).toBeInTheDocument();
    expect(screen.getAllByText("Cansancio").length).toBeGreaterThan(0);
    expect(screen.getByText("43%")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
    expect(screen.getByText("22%")).toBeInTheDocument();
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
          p1: { readiness: 65, availability: 33, physicalFitness: 55, fatigue: 22 },
        }}
      />,
    );

    const legends = screen.getAllByLabelText("Leyenda de Ef, Rodaje y Cansancio");
    expect(legends).toHaveLength(1);
  });
});
