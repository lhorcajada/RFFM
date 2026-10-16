import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ConvocationTab from "../ConvocationTab";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { DeconvokeProposal } from "../../utils/deconvokeProposal";

const players = [
  { id: "p1", name: "Ana", lastName: "Uno", alias: null, dorsal: 1, position: "Delantero", isInjured: false },
] as unknown as PlayerResponse[];

const emptyProposal = {
  targetCount: 0,
  calledCount: 0,
  previousRivalResult: null,
  players: [],
} as unknown as DeconvokeProposal;

function renderTab(teamAvgRating: number) {
  return render(
    <ConvocationTab
      mgmtEventId="event-1"
      mgmtLoadingConv={false}
      loadingPlayers={false}
      teamAvgRating={teamAvgRating}
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
    />,
  );
}

describe("ConvocationTab — valoración media de los convocados", () => {
  it("explica qué significa el número de la cabecera de convocados", () => {
    renderTab(6.2);

    const avg = screen.getByLabelText("Valoración media de los convocados: 6");
    expect(avg).toHaveAttribute("title", "Valoración media de los convocados (1-10)");
  });

  it("pinta en verde una media de 7 o más", () => {
    renderTab(7.4);

    expect(screen.getByLabelText("Valoración media de los convocados: 7")).toHaveStyle({ color: "#66bb6a" });
  });

  it("pinta en ámbar una media entre 5 y 7", () => {
    renderTab(6.2);

    expect(screen.getByLabelText("Valoración media de los convocados: 6")).toHaveStyle({ color: "#ffb300" });
  });

  it("pinta en rojo una media por debajo de 5", () => {
    renderTab(4.2);

    expect(screen.getByLabelText("Valoración media de los convocados: 4")).toHaveStyle({ color: "#ef5350" });
  });
});
