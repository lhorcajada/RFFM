import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ConvocationTab from "../ConvocationTab";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { DeconvokeProposal } from "../../utils/deconvokeProposal";

const players = [
  { id: "p1", name: "Ana", lastName: "Uno", alias: null, dorsal: 1, position: "Delantero", isInjured: false },
  { id: "p2", name: "Bea", lastName: "Dos", alias: null, dorsal: 2, position: "Defensa", isInjured: false },
  { id: "p3", name: "Carla", lastName: "Tres", alias: null, dorsal: 3, position: "Medio", isInjured: false },
] as unknown as PlayerResponse[];

const emptyProposal = {
  targetCount: 0,
  calledCount: 0,
  previousRivalResult: null,
  players: [],
} as unknown as DeconvokeProposal;

const onCallPlayers = vi.fn();

function renderTab(available: string[] = ["p1", "p2"]) {
  return render(
    <ConvocationTab
      mgmtEventId="event-1"
      mgmtLoadingConv={false}
      loadingPlayers={false}
      teamAvgRating={null}
      mgmtCalled={["p3"]}
      mgmtAvailable={available}
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
      onCallPlayers={onCallPlayers}
      proposal={emptyProposal}
      proposalLoading={false}
      onApplyProposal={async () => {}}
      onPrintProposal={async () => {}}
    />,
  );
}

describe("ConvocationTab — convocar disponibles con checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onCallPlayers.mockResolvedValue(undefined);
  });

  it("muestra un check por cada jugador disponible y ninguno en convocados", () => {
    renderTab();

    expect(screen.getByRole("checkbox", { name: "Seleccionar Ana Uno" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Seleccionar Bea Dos" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Seleccionar Carla Tres" })).not.toBeInTheDocument();
  });

  it("deshabilita 'Convocar seleccionados' mientras no hay ninguno marcado", () => {
    renderTab();

    expect(screen.getByRole("button", { name: /Convocar seleccionados/ })).toBeDisabled();
  });

  it("convoca solo los jugadores marcados", async () => {
    renderTab();

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Bea Dos" }));
    fireEvent.click(screen.getByRole("button", { name: "Convocar seleccionados (1)" }));

    await waitFor(() => expect(onCallPlayers).toHaveBeenCalledWith(["p2"]));
  });

  it("'Seleccionar todos' marca todos los disponibles", async () => {
    renderTab();

    fireEvent.click(screen.getByRole("button", { name: "Seleccionar todos" }));
    fireEvent.click(screen.getByRole("button", { name: "Convocar seleccionados (2)" }));

    await waitFor(() => expect(onCallPlayers).toHaveBeenCalledWith(["p1", "p2"]));
  });

  it("no muestra las acciones de convocatoria múltiple si no hay disponibles", () => {
    renderTab([]);

    expect(screen.queryByRole("button", { name: /Convocar seleccionados/ })).not.toBeInTheDocument();
  });
});
