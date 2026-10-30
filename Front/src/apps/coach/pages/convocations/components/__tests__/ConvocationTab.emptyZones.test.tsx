import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import ConvocationTab from "../ConvocationTab";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { DeconvokeProposal } from "../../utils/deconvokeProposal";

const player = (id: string) =>
  ({ id, name: id, lastName: "", alias: id, dorsal: null, position: "Delantero", isInjured: false }) as unknown as PlayerResponse;

const emptyProposal: DeconvokeProposal = {
  generatedAt: "2026-01-01T00:00:00Z",
  targetCount: 0,
  calledCount: 0,
  selectedIds: [],
  previousRivalResult: null,
  players: [],
  positionWarnings: [],
};

type Zones = {
  waiting?: string[];
  pending?: string[];
  available?: string[];
  called?: string[];
  notCalled?: string[];
};

const onDrop = vi.fn();
const onDragOver = vi.fn();

function tab(zones: Zones) {
  const ids = Object.values(zones).flat();
  return (
    <ConvocationTab
      mgmtEventId="event-1"
      mgmtLoadingConv={false}
      loadingPlayers={false}
      teamAvgRating={null}
      isLeagueMatch
      mgmtWaiting={zones.waiting ?? []}
      mgmtAvailabilityPending={zones.pending ?? []}
      mgmtAvailable={zones.available ?? []}
      mgmtCalled={zones.called ?? []}
      mgmtNotCalled={zones.notCalled ?? []}
      players={ids.map(player)}
      mgmtRatings={{}}
      mgmtPhotos={{}}
      mgmtExcuseMap={{}}
      excuseTypes={[]}
      mgmtDragPlayer={null}
      mgmtDragOver={null}
      onDragStart={() => {}}
      onDragEnd={() => {}}
      onDragOver={onDragOver}
      onDragLeave={() => {}}
      onDrop={onDrop}
      onExcuseChange={() => {}}
      proposal={emptyProposal}
      proposalLoading={false}
      onApplyProposal={async () => {}}
      onPrintProposal={async () => {}}
    />
  );
}

const foldedZone = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}\\s*0$`) });

describe("ConvocationTab - zonas vacías plegadas", () => {
  it("pinta como botón plegado, con contador 0, cada zona sin jugadores", () => {
    render(tab({ called: ["c1"], notCalled: ["n1"] }));

    for (const name of ["Lista de espera", "Pendientes de respuesta", "Disponibles"]) {
      expect(foldedZone(name)).toHaveAttribute("aria-expanded", "false");
    }
  });

  it("no pinta columna para las zonas vacías", () => {
    render(tab({ called: ["c1"], notCalled: ["n1"] }));

    expect(screen.queryByRole("region", { name: "Disponibles" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Lista de espera" })).not.toBeInTheDocument();
  });

  it("pinta como columna las zonas con jugadores", () => {
    render(tab({ called: ["c1"], notCalled: ["n1"] }));

    expect(screen.getByRole("region", { name: "Convocados" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Desconvocados" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Convocados\s*0$/ })).not.toBeInTheDocument();
  });

  it("también pliega Convocados y Desconvocados cuando están vacíos", () => {
    render(tab({ available: ["a1"] }));

    expect(foldedZone("Convocados")).toHaveAttribute("aria-expanded", "false");
    expect(foldedZone("Desconvocados")).toHaveAttribute("aria-expanded", "false");
  });

  it("despliega la zona como columna al pulsar su botón", () => {
    render(tab({ called: ["c1"] }));

    fireEvent.click(foldedZone("Disponibles"));

    const region = screen.getByRole("region", { name: "Disponibles" });
    expect(within(region).getByRole("button", { expanded: true })).toBeInTheDocument();
    expect(within(region).getByText("Arrastra jugadores aquí")).toBeInTheDocument();
  });

  it("vuelve a plegar una zona desplegada al pulsar su cabecera", () => {
    render(tab({ called: ["c1"] }));
    fireEvent.click(foldedZone("Disponibles"));

    fireEvent.click(within(screen.getByRole("region", { name: "Disponibles" })).getByRole("button"));

    expect(foldedZone("Disponibles")).toHaveAttribute("aria-expanded", "false");
  });

  it("muestra como columna una zona plegada en cuanto recibe un jugador", () => {
    const { rerender } = render(tab({ called: ["c1"] }));

    rerender(tab({ called: ["c1"], available: ["a1"] }));

    expect(screen.getByRole("region", { name: "Disponibles" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Disponibles\s*0$/ })).not.toBeInTheDocument();
  });

  it("vuelve a plegar una zona abierta cuando se queda otra vez sin jugadores", () => {
    const { rerender } = render(tab({ called: ["c1"], available: ["a1"] }));
    rerender(tab({ called: ["c1"] }));

    expect(foldedZone("Disponibles")).toHaveAttribute("aria-expanded", "false");
  });

  it("permite soltar un jugador sobre una zona plegada", () => {
    onDrop.mockClear();
    onDragOver.mockClear();
    render(tab({ called: ["c1"] }));
    const folded = foldedZone("Disponibles");

    fireEvent.dragOver(folded);
    fireEvent.drop(folded);

    expect(onDragOver).toHaveBeenCalledWith("available");
    expect(onDrop).toHaveBeenCalledWith("available");
  });
});
