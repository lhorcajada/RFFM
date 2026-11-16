import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ConvocationTab from "../ConvocationTab";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { DeconvokeProposal } from "../../utils/deconvokeProposal";

const player = (id: string, alias: string) =>
  ({ id, name: alias, lastName: "", alias, dorsal: null, position: "Delantero", isInjured: false }) as unknown as PlayerResponse;

const emptyProposal: DeconvokeProposal = {
  generatedAt: "2026-01-01T00:00:00Z",
  targetCount: 0,
  calledCount: 0,
  selectedIds: [],
  previousRivalResult: null,
  players: [],
  positionWarnings: [],
  alreadyDeconvoked: [],
  order: [],
};

function renderTab(readOnly: boolean) {
  render(
    <ConvocationTab
      mgmtEventId="event-1"
      mgmtLoadingConv={false}
      loadingPlayers={false}
      teamAvgRating={null}
      mgmtCalled={["p1"]}
      mgmtAvailable={[]}
      mgmtNotCalled={["p2"]}
      players={[player("p1", "Ana Uno"), player("p2", "Bea Dos")]}
      mgmtRatings={{}}
      mgmtPhotos={{}}
      mgmtExcuseMap={{}}
      excuseTypes={[{ id: 3, name: "Enfermedad", justified: true }]}
      mgmtDragPlayer={null}
      mgmtDragOver={null}
      onDragStart={() => {}}
      onDragEnd={() => {}}
      onDragOver={() => {}}
      onDragLeave={() => {}}
      onDrop={() => {}}
      onExcuseChange={() => {}}
      onCallPlayers={vi.fn()}
      onDeconvokePlayer={vi.fn()}
      proposal={emptyProposal}
      proposalLoading={false}
      onApplyProposal={async () => {}}
      readOnly={readOnly}
    />,
  );
}

describe("ConvocationTab - solo lectura", () => {
  it("oculta «Proponer desconvocados»", () => {
    renderTab(true);

    expect(screen.queryByRole("button", { name: /proponer desconvocados/i })).not.toBeInTheDocument();
  });

  it("oculta los botones de convocar y desconvocar", () => {
    renderTab(true);

    expect(screen.queryByRole("button", { name: "Desconvocar a Ana Uno" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Convocar a Bea Dos" })).not.toBeInTheDocument();
  });

  it("no ofrece el selector para cambiar el motivo de la desconvocatoria", () => {
    renderTab(true);

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("sigue mostrando a los jugadores convocados y desconvocados", () => {
    renderTab(true);

    expect(screen.getByText("Ana Uno")).toBeInTheDocument();
    expect(screen.getByText("Bea Dos")).toBeInTheDocument();
  });

  it("sin solo lectura mantiene «Proponer desconvocados»", () => {
    renderTab(false);

    expect(screen.getByRole("button", { name: /proponer desconvocados/i })).toBeInTheDocument();
  });
});
