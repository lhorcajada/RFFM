import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ConvocationTab from "../ConvocationTab";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { DeconvokeProposal } from "../../utils/deconvokeProposal";

const player = (id: string, alias: string) =>
  ({ id, name: alias, lastName: "", alias, dorsal: null, position: "Delantero", isInjured: false }) as unknown as PlayerResponse;

const players = [player("p1", "Ana Uno"), player("p2", "Bea Dos")];

const emptyProposal: DeconvokeProposal = {
  generatedAt: "2026-01-01T00:00:00Z",
  targetCount: 0,
  calledCount: 0,
  selectedIds: [],
  previousRivalResult: null,
  players: [],
  positionWarnings: [],
};

function renderTab(handlers: {
  onDeconvokePlayer?: (playerId: string) => Promise<void>;
  onCallPlayers?: (playerIds: string[]) => Promise<void>;
}) {
  render(
    <ConvocationTab
      mgmtEventId="event-1"
      mgmtLoadingConv={false}
      loadingPlayers={false}
      teamAvgRating={null}
      mgmtCalled={["p1"]}
      mgmtAvailable={[]}
      mgmtNotCalled={["p2"]}
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
      {...handlers}
    />,
  );
}

describe("ConvocationTab - acciones táctiles", () => {
  it("«Desconvocar a X» desconvoca al jugador convocado", () => {
    const onDeconvokePlayer = vi.fn().mockResolvedValue(undefined);
    renderTab({ onDeconvokePlayer });

    fireEvent.click(screen.getByRole("button", { name: "Desconvocar a Ana Uno" }));

    expect(onDeconvokePlayer).toHaveBeenCalledWith("p1");
  });

  it("«Convocar a X» convoca al jugador desconvocado", () => {
    const onCallPlayers = vi.fn().mockResolvedValue(undefined);
    renderTab({ onCallPlayers });

    fireEvent.click(screen.getByRole("button", { name: "Convocar a Bea Dos" }));

    expect(onCallPlayers).toHaveBeenCalledWith(["p2"]);
  });

  it("no muestra los botones si la pantalla no ofrece las acciones", () => {
    renderTab({});

    expect(screen.queryByRole("button", { name: "Desconvocar a Ana Uno" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Convocar a Bea Dos" })).not.toBeInTheDocument();
  });
});
