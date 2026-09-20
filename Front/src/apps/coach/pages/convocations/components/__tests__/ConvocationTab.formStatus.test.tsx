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


function renderTab(stats: { readiness: number; fatigue: number; formStatus?: number | null }) {
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
      readinessMap={{ p1: stats }}
    />,
  );
}

describe("ConvocationTab - Estado de forma del backend", () => {
  it("muestra en Ef el formStatus del backend cuando difiere del cálculo local", () => {
    renderTab({ readiness: 65, fatigue: 22, formStatus: 33 });

    expect(screen.getByTestId("player-form-bar-ef")).toHaveTextContent("33%");
  });

  it("cae al cálculo local de Ef cuando no hay formStatus", () => {
    renderTab({ readiness: 65, fatigue: 22 });

    expect(screen.getByTestId("player-form-bar-ef")).toHaveTextContent("58%");
  });
});
