import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConvocationTab from "../ConvocationTab";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { DeconvokeProposal, PlayerProposal } from "../../utils/deconvokeProposal";

const players: PlayerResponse[] = [
  { id: "p1", name: "Jugador", alias: "Pepe", position: "Líbero" },
  { id: "p2", name: "Jugador", alias: "Nuevo", position: "Comodín" },
];

function proposalPlayer(overrides: Partial<PlayerProposal>): PlayerProposal {
  return {
    playerId: "p1",
    displayName: "Pepe",
    position: "Líbero",
    positionRole: "centreBack",
    isSelected: false,
    forced: false,
    score: 10,
    factors: [],
    summary: "",
    calledCount: 0,
    startsCount: 0,
    startsDataAvailable: false,
    minRequiredCalls: 0,
    weeklyTraining: {
      totalTrainings: 0,
      attendedTrainings: 0,
      weightedAttendedTrainings: 0,
      attendedTrainingsSeason: 0,
      weightedAttendedTrainingsSeason: 0,
      totalTrainingsSeason: 0,
      knownUnavailableTrainings: 0,
    },
    ...overrides,
  };
}

function proposal(overrides: Partial<DeconvokeProposal> = {}): DeconvokeProposal {
  return {
    generatedAt: "2026-10-14T10:00:00.000Z",
    targetCount: 1,
    calledCount: 2,
    selectedIds: ["p2"],
    previousRivalResult: null,
    players: [
      proposalPlayer({
        factors: [{ key: "positionProtection", label: "Protegido: mínimo de 3 centrales", value: 3, impact: 0 }],
      }),
      proposalPlayer({ playerId: "p2", displayName: "Nuevo", position: "Comodín", positionRole: null, isSelected: true }),
    ],
    positionWarnings: [],
    ...overrides,
  };
}

function renderTab(value: DeconvokeProposal) {
  render(
    <ConvocationTab
      mgmtEventId="event-1"
      mgmtLoadingConv={false}
      loadingPlayers={false}
      teamAvgRating={null}
      mgmtCalled={["p1", "p2"]}
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
      proposal={value}
      proposalLoading={false}
      onApplyProposal={async () => {}}
      onPrintProposal={async () => {}}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /proponer desconvocados/i }));
}

describe("ConvocationTab - posiciones en la propuesta", () => {
  it("muestra los mínimos de posición que no se cumplen", () => {
    renderTab(
      proposal({
        positionWarnings: [{ requirement: "centreBack", label: "Centrales", required: 3, remaining: 2 }],
      }),
    );

    expect(screen.getByText("Centrales: quedan 2 de 3")).toBeInTheDocument();
  });

  it("no muestra avisos de posición cuando se cumplen todos los mínimos", () => {
    renderTab(proposal());

    expect(screen.queryByText(/mínimos de posición/i)).not.toBeInTheDocument();
  });

  it("muestra el rol de cada jugador o «Sin posición»", () => {
    renderTab(proposal());

    expect(screen.getByText("Central")).toHaveAttribute("title", "Líbero");
    expect(screen.getByText("Sin posición")).toHaveAttribute("title", "Comodín");
  });

  it("muestra el motivo de protección del jugador", () => {
    renderTab(proposal());

    expect(screen.getByText("Protegido: mínimo de 3 centrales")).toBeInTheDocument();
  });
});
