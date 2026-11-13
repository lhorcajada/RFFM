import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import ConvocationTab from "../ConvocationTab";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type {
  AlreadyDeconvokedPlayer,
  DeconvokeProposal,
  PlayerProposal,
} from "../../utils/deconvokeProposal";

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
    locked: false,
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
    decision: { group: overrides.isSelected ? "proposed" : "notChosen", reason: "Motivo" },
    detail: [],
    ...overrides,
  };
}

function alreadyOut(overrides: Partial<AlreadyDeconvokedPlayer>): AlreadyDeconvokedPlayer {
  return {
    playerId: "x1",
    displayName: "Iker Ruiz",
    position: "Central",
    positionRole: "centreBack",
    ...overrides,
  };
}

function proposal(overrides: Partial<DeconvokeProposal> = {}): DeconvokeProposal {
  return {
    generatedAt: "2026-10-14T10:00:00.000Z",
    rivalDifficulty: "medium",
    targetCount: 1,
    calledCount: 2,
    selectedIds: ["p2"],
    previousRivalResult: null,
    players: [proposalPlayer({ playerId: "p2", displayName: "Propuesto Dos", isSelected: true })],
    positionWarnings: [],
    alreadyDeconvoked: [],
    ...overrides,
  };
}

function renderTab(value: DeconvokeProposal) {
  const view = render(
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

    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /proponer desconvocados/i }));
  return view;
}

describe("ConvocationTab - estructura del bloque de propuesta", () => {
  it("coloca las filas de propuestos por puntuación y después la fila de ya desconvocados", () => {
    renderTab(
      proposal({
        players: [
          proposalPlayer({ playerId: "p2", displayName: "Propuesto Ochenta", isSelected: true, score: 80 }),
          proposalPlayer({ playerId: "p3", displayName: "Propuesto Sesenta", isSelected: true, score: 60 }),
        ],
        selectedIds: ["p2", "p3"],
        alreadyDeconvoked: [alreadyOut({ playerId: "x1", displayName: "Iker Ruiz" })],
      }),
    );

    const rows = screen.getAllByRole("article");

    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("Propuesto Ochenta")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Propuesto Sesenta")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Iker Ruiz")).toBeInTheDocument();
  });

  it("muestra «Ya desconvocado» solo dentro del grupo de ya desconvocados", () => {
    renderTab(
      proposal({
        alreadyDeconvoked: [
          alreadyOut({ playerId: "x1", displayName: "Iker Ruiz" }),
          alreadyOut({ playerId: "x2", displayName: "Mario Gil" }),
        ],
      }),
    );

    const group = screen.getByRole("group", { name: "Jugadores ya desconvocados" });
    const proposedRow = screen.getByText("Propuesto Dos").closest("article") as HTMLElement;

    expect(within(group).getAllByText("Ya desconvocado")).toHaveLength(2);
    expect(screen.getAllByText("Ya desconvocado")).toHaveLength(2);
    expect(within(proposedRow).queryByText("Ya desconvocado")).not.toBeInTheDocument();
  });

  it("no renderiza el grupo ni la marca cuando no hay jugadores ya desconvocados", () => {
    renderTab(proposal({ alreadyDeconvoked: [] }));

    expect(screen.queryByRole("group", { name: /ya desconvocados/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Ya desconvocado")).not.toBeInTheDocument();
  });

  it("mantiene los datos de la fila de un propuesto obligatorio", () => {
    renderTab(
      proposal({
        players: [
          proposalPlayer({
            playerId: "p2",
            displayName: "Obligado Uno",
            isSelected: true,
            forced: true,
            score: 70,
            positionRole: "centreBack",
            calledCount: 3,
          }),
        ],
      }),
    );

    const row = screen.getByText("Obligado Uno").closest("article") as HTMLElement;

    expect(within(row).getByText("Obligatorio")).toBeInTheDocument();
    expect(within(row).getByText(/3 conv\./)).toBeInTheDocument();
  });

  it("con solo ya desconvocados muestra el grupo con sus filas y ningún aviso de lista vacía", () => {
    renderTab(
      proposal({
        players: [],
        selectedIds: [],
        alreadyDeconvoked: [alreadyOut({ playerId: "x1", displayName: "Iker Ruiz" })],
      }),
    );

    const group = screen.getByRole("group", { name: "Jugadores ya desconvocados" });

    expect(within(group).getByText("Iker Ruiz")).toBeInTheDocument();
    expect(screen.queryByText("No hay convocados para evaluar.")).not.toBeInTheDocument();
  });

  it("no usa ninguna tabla en el bloque de propuesta", () => {
    const { container } = renderTab(
      proposal({
        players: [
          proposalPlayer({ playerId: "p2", displayName: "Propuesto Dos", isSelected: true }),
          proposalPlayer({ playerId: "p1", displayName: "Titular Uno", isSelected: false }),
        ],
        alreadyDeconvoked: [alreadyOut({ playerId: "x1", displayName: "Iker Ruiz" })],
      }),
    );

    expect(container.querySelector("table")).toBeNull();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("el aviso de que no hace falta desconvocar no lleva estilo en línea", () => {
    renderTab(
      proposal({
        players: [proposalPlayer({ playerId: "p1", displayName: "Titular Uno", isSelected: false })],
        selectedIds: [],
      }),
    );

    const notice = screen.getByText("No hace falta desconvocar jugadores con las reglas actuales.");

    expect(notice).not.toHaveAttribute("style");
  });
});
