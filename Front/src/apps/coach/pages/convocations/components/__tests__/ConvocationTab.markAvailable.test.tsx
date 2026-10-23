import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ConvocationTab from "../ConvocationTab";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { DeconvokeProposal } from "../../utils/deconvokeProposal";

const players = [
  { id: "p-req", name: "Ana", lastName: "Uno", alias: null, dorsal: 1, position: "Delantero", isInjured: false },
  { id: "p-av", name: "Bea", lastName: "Dos", alias: null, dorsal: 2, position: "Defensa", isInjured: false },
] as unknown as PlayerResponse[];

const emptyProposal = {
  targetCount: 0,
  calledCount: 0,
  previousRivalResult: null,
  players: [],
} as unknown as DeconvokeProposal;

const onMarkAvailable = vi.fn();

function renderTab(withHandler = true) {
  return render(
    <ConvocationTab
      mgmtEventId="event-1"
      mgmtLoadingConv={false}
      loadingPlayers={false}
      teamAvgRating={null}
      isLeagueMatch
      mgmtWaiting={[]}
      mgmtAvailabilityPending={["p-req"]}
      mgmtCalled={[]}
      mgmtAvailable={["p-av"]}
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
      onMarkAvailable={withHandler ? onMarkAvailable : undefined}
      proposal={emptyProposal}
      proposalLoading={false}
      onApplyProposal={async () => {}}
      onPrintProposal={async () => {}}
    />,
  );
}

describe("ConvocationTab — marcar disponibles a los pendientes de respuesta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onMarkAvailable.mockResolvedValue(undefined);
  });

  it("muestra el botón «Disponible» solo en los pendientes de respuesta", () => {
    renderTab();

    expect(screen.getByRole("button", { name: "Marcar disponible a Ana Uno" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar disponible a Bea Dos" })).not.toBeInTheDocument();
  });

  it("al pulsar «Disponible» marca al jugador como disponible", async () => {
    renderTab();

    fireEvent.click(screen.getByRole("button", { name: "Marcar disponible a Ana Uno" }));

    await waitFor(() => expect(onMarkAvailable).toHaveBeenCalledWith("p-req"));
  });

  it("no muestra el botón si no se puede marcar disponible", () => {
    renderTab(false);

    expect(screen.queryByRole("button", { name: /Marcar disponible/ })).not.toBeInTheDocument();
  });
});
