import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import ConvocationTab from "../ConvocationTab";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { ExcuseType } from "../../../../services/excuseTypeService";
import type { DeconvokeProposal } from "../../utils/deconvokeProposal";

const players = [
  { id: "p-wait", name: "Daniel", lastName: "Ruiz", alias: null, dorsal: 7, position: "Delantero", isInjured: false },
  { id: "p-req", name: "Ana", lastName: "Pendiente", alias: null, dorsal: 2, position: "Defensa", isInjured: false },
  { id: "p-av", name: "Bea", lastName: "Disponible", alias: null, dorsal: 3, position: "Defensa", isInjured: false },
  { id: "p-called", name: "Hugo", lastName: "Martin", alias: null, dorsal: 1, position: "Portero", isInjured: false },
  { id: "p-out", name: "Ivan", lastName: "Torres", alias: null, dorsal: 10, position: "Medio", isInjured: false },
] as unknown as PlayerResponse[];

const excuseTypes = [
  { id: 1, name: "Lesión" },
  { id: 2, name: "Decisión técnica" },
] as unknown as ExcuseType[];

const emptyProposal = {
  targetCount: 0,
  calledCount: 0,
  previousRivalResult: null,
  players: [],
} as unknown as DeconvokeProposal;

const onCallPlayers = vi.fn();
const onDeconvokePlayer = vi.fn();
const onExcuseChange = vi.fn();

function renderTab(isLeagueMatch = true) {
  return render(
    <ConvocationTab
      mgmtEventId="event-1"
      mgmtLoadingConv={false}
      loadingPlayers={false}
      teamAvgRating={null}
      isLeagueMatch={isLeagueMatch}
      mgmtWaiting={["p-wait"]}
      mgmtAvailabilityPending={["p-req"]}
      mgmtAvailable={["p-av"]}
      mgmtCalled={["p-called"]}
      mgmtNotCalled={["p-out"]}
      players={players}
      mgmtRatings={{}}
      mgmtPhotos={{}}
      mgmtExcuseMap={{ "p-out": 2 }}
      excuseTypes={excuseTypes}
      mgmtDragPlayer={null}
      mgmtDragOver={null}
      onDragStart={() => {}}
      onDragEnd={() => {}}
      onDragOver={() => {}}
      onDragLeave={() => {}}
      onDrop={() => {}}
      onExcuseChange={onExcuseChange}
      onCallPlayers={onCallPlayers}
      onDeconvokePlayer={onDeconvokePlayer}
      proposal={emptyProposal}
      proposalLoading={false}
      onApplyProposal={async () => {}}
    />,
  );
}

describe("ConvocationTab — partido de liga solo del entrenador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onCallPlayers.mockResolvedValue(undefined);
    onDeconvokePlayer.mockResolvedValue(undefined);
  });

  it("muestra solo Lista de espera, Convocados y Desconvocados", () => {
    renderTab();

    const titles = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
    expect(titles).toEqual(["Lista de espera", "Convocados", "Desconvocados"]);
    expect(screen.queryByText("Pendientes de respuesta")).not.toBeInTheDocument();
    expect(screen.queryByText("Disponibles")).not.toBeInTheDocument();
  });

  it("agrupa en la lista de espera a los jugadores con solicitudes de disponibilidad antiguas", () => {
    renderTab();

    const waiting = screen.getByRole("region", { name: "Lista de espera" });
    expect(within(waiting).getByText("Daniel Ruiz")).toBeInTheDocument();
    expect(within(waiting).getByText("Ana Pendiente")).toBeInTheDocument();
    expect(within(waiting).getByText("Bea Disponible")).toBeInTheDocument();
  });

  it("no muestra el botón Disponible", () => {
    renderTab();

    expect(screen.queryByRole("button", { name: /Marcar disponible/ })).not.toBeInTheDocument();
  });

  it("mantiene las zonas de un amistoso", () => {
    renderTab(false);

    expect(screen.getByRole("region", { name: "Disponibles" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Lista de espera" })).not.toBeInTheDocument();
  });

  it("convoca desde la lista de espera", () => {
    renderTab();

    fireEvent.click(screen.getByRole("button", { name: "Convocar a Daniel Ruiz" }));

    expect(onCallPlayers).toHaveBeenCalledWith(["p-wait"]);
  });

  it("abre el selector de motivo al desconvocar desde la lista de espera sin mover al jugador", () => {
    renderTab();

    fireEvent.click(screen.getByRole("button", { name: "Desconvocar a Daniel Ruiz" }));

    expect(screen.getByRole("dialog", { name: "Motivo de desconvocatoria" })).toBeInTheDocument();
    expect(onDeconvokePlayer).not.toHaveBeenCalled();
  });

  it("deshabilita Desconvocar hasta elegir un motivo", () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Desconvocar a Daniel Ruiz" }));

    const dialog = screen.getByRole("dialog", { name: "Motivo de desconvocatoria" });

    expect(within(dialog).getByRole("button", { name: "Desconvocar" })).toBeDisabled();
  });

  it("desconvoca con el motivo elegido", async () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Desconvocar a Daniel Ruiz" }));
    const dialog = screen.getByRole("dialog", { name: "Motivo de desconvocatoria" });

    fireEvent.click(within(dialog).getByRole("radio", { name: "Lesión" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Desconvocar" }));

    await waitFor(() => expect(onDeconvokePlayer).toHaveBeenCalledWith("p-wait", 1));
  });

  it("no cambia nada al cancelar el selector", () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Desconvocar a Daniel Ruiz" }));
    const dialog = screen.getByRole("dialog", { name: "Motivo de desconvocatoria" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    expect(onDeconvokePlayer).not.toHaveBeenCalled();
  });

  it("pide el motivo también al desconvocar a un convocado", () => {
    renderTab();

    fireEvent.click(screen.getByRole("button", { name: "Desconvocar a Hugo Martin" }));

    expect(screen.getByRole("dialog", { name: "Motivo de desconvocatoria" })).toBeInTheDocument();
    expect(onDeconvokePlayer).not.toHaveBeenCalled();
  });

  it("muestra el motivo dentro de la ficha del desconvocado y sin selector externo", () => {
    const { container } = renderTab();

    const card = container.querySelector('[data-player-id="p-out"]') as HTMLElement;

    expect(within(card).getByText("Motivo: Decisión técnica")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("cambia el motivo desde la franja de la ficha", async () => {
    const { container } = renderTab();
    const card = container.querySelector('[data-player-id="p-out"]') as HTMLElement;

    fireEvent.click(within(card).getByText("Motivo: Decisión técnica"));
    const dialog = screen.getByRole("dialog", { name: "Motivo de desconvocatoria" });
    expect(within(dialog).getByRole("radio", { name: "Decisión técnica" })).toBeChecked();

    fireEvent.click(within(dialog).getByRole("radio", { name: "Lesión" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar motivo" }));

    await waitFor(() => expect(onExcuseChange).toHaveBeenCalledWith("p-out", 1));
  });

  it("vuelve a convocar a un desconvocado", () => {
    renderTab();

    fireEvent.click(screen.getByRole("button", { name: "Convocar a Ivan Torres" }));

    expect(onCallPlayers).toHaveBeenCalledWith(["p-out"]);
  });
});
