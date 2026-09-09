import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

describe("ConvocationTab - indicador de disponibilidad", () => {
  it("muestra la disponibilidad del jugador convocado", () => {
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

    expect(screen.getByText("33%")).toBeInTheDocument();
  });

  it("muestra la leyenda de Disponibilidad", () => {
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

    const availabilityLegend = screen.getByLabelText("Leyenda de Disponibilidad");
    expect(within(availabilityLegend).getByText("≥80")).toBeInTheDocument();
    expect(within(availabilityLegend).getByText("50-79")).toBeInTheDocument();
    expect(within(availabilityLegend).getByText("<50")).toBeInTheDocument();
  });
});
