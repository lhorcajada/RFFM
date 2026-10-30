import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

function renderTab(isLeagueMatch: boolean, zones: Zones) {
  const ids = Object.values(zones).flat();
  render(
    <ConvocationTab
      mgmtEventId="event-1"
      mgmtLoadingConv={false}
      loadingPlayers={false}
      teamAvgRating={null}
      isLeagueMatch={isLeagueMatch}
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

describe("ConvocationTab - resumen", () => {
  it("en liga muestra un contador por cada zona", () => {
    renderTab(true, {
      waiting: ["w1"],
      pending: ["r1", "r2"],
      available: ["a1", "a2", "a3"],
      called: ["c1", "c2", "c3", "c4"],
      notCalled: ["n1"],
    });

    const summary = screen.getByLabelText("Resumen de la convocatoria");
    expect(within(summary).getByLabelText("Lista de espera: 1")).toBeInTheDocument();
    expect(within(summary).getByLabelText("Pendientes de respuesta: 2")).toBeInTheDocument();
    expect(within(summary).getByLabelText("Disponibles: 3")).toBeInTheDocument();
    expect(within(summary).getByLabelText("Convocados: 4")).toBeInTheDocument();
    expect(within(summary).getByLabelText("Desconvocados: 1")).toBeInTheDocument();
  });

  it("en un partido sin liga no muestra los contadores de espera ni de pendientes", () => {
    renderTab(false, { available: ["a1"], called: ["c1", "c2"], notCalled: [] });

    const summary = screen.getByLabelText("Resumen de la convocatoria");
    expect(within(summary).getByLabelText("Disponibles: 1")).toBeInTheDocument();
    expect(within(summary).getByLabelText("Convocados: 2")).toBeInTheDocument();
    expect(within(summary).getByLabelText("Desconvocados: 0")).toBeInTheDocument();
    expect(within(summary).queryByLabelText(/Lista de espera/)).not.toBeInTheDocument();
    expect(within(summary).queryByLabelText(/Pendientes de respuesta/)).not.toBeInTheDocument();
  });

  it("muestra los jugadores como filas, sin tabla", () => {
    renderTab(false, { called: ["c1"] });

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("c1")).toBeInTheDocument();
  });
});
