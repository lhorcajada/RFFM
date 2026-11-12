import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
    targetCount: 1,
    calledCount: 2,
    selectedIds: ["p2"],
    previousRivalResult: null,
    players: [
      proposalPlayer({ playerId: "p1", displayName: "Titular Uno" }),
      proposalPlayer({
        playerId: "p2",
        displayName: "Propuesto Dos",
        position: "Comodín",
        positionRole: null,
        isSelected: true,
      }),
    ],
    positionWarnings: [],
    alreadyDeconvoked: [],
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

const NO_SELECTION_NOTICE = "No hace falta desconvocar jugadores con las reglas actuales.";
const NO_CALLED_NOTICE = "No hay convocados para evaluar.";

describe("ConvocationTab - jugadores ya desconvocados en la propuesta", () => {
  it("marca cada jugador ya desconvocado con «Ya desconvocado»", () => {
    renderTab(
      proposal({
        alreadyDeconvoked: [
          alreadyOut({ playerId: "x1", displayName: "Iker Ruiz" }),
          alreadyOut({ playerId: "x2", displayName: "Mario Gil", positionRole: "wide", position: "Banda" }),
        ],
      }),
    );

    expect(screen.getAllByText("Ya desconvocado")).toHaveLength(2);
    expect(screen.getByText("Iker Ruiz")).toBeInTheDocument();
    expect(screen.getByText("Mario Gil")).toBeInTheDocument();
  });

  it("muestra a los propuestos y a los ya desconvocados en el mismo bloque, primero los propuestos", () => {
    renderTab(
      proposal({
        players: [
          proposalPlayer({ playerId: "p2", displayName: "Propuesto Uno", isSelected: true, score: 1 }),
          proposalPlayer({ playerId: "p3", displayName: "Propuesto Dos", isSelected: true, score: 2 }),
        ],
        selectedIds: ["p2", "p3"],
        alreadyDeconvoked: [alreadyOut({ playerId: "x1", displayName: "Iker Ruiz" })],
      }),
    );

    const sectionLabel = screen.getByText("Propuestos para desconvocar");
    const first = screen.getByText("Propuesto Uno");
    const second = screen.getByText("Propuesto Dos");
    const already = screen.getByText("Iker Ruiz");

    expect(sectionLabel.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(second.compareDocumentPosition(already) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText("Resto de convocados")).not.toBeInTheDocument();
  });

  it("no muestra la marca cuando no hay jugadores ya desconvocados", () => {
    renderTab(proposal({ alreadyDeconvoked: [] }));

    expect(screen.queryByText("Ya desconvocado")).not.toBeInTheDocument();
    expect(screen.getByText("Propuestos para desconvocar")).toBeInTheDocument();
    expect(screen.queryByText(NO_SELECTION_NOTICE)).not.toBeInTheDocument();
    expect(screen.queryByText(NO_CALLED_NOTICE)).not.toBeInTheDocument();
  });

  it("con solo ya desconvocados muestra al jugador y no muestra los avisos de lista vacía", () => {
    renderTab(
      proposal({
        players: [],
        selectedIds: [],
        alreadyDeconvoked: [alreadyOut({ playerId: "x1", displayName: "Iker Ruiz" })],
      }),
    );

    expect(screen.getByText("Iker Ruiz")).toBeInTheDocument();
    expect(screen.getByText("Ya desconvocado")).toBeInTheDocument();
    expect(screen.queryByText(NO_CALLED_NOTICE)).not.toBeInTheDocument();
    expect(screen.queryByText(NO_SELECTION_NOTICE)).not.toBeInTheDocument();
  });

  it("sin propuestos seleccionados mantiene el aviso de que no hace falta desconvocar y lista a los ya desconvocados", () => {
    renderTab(
      proposal({
        players: [proposalPlayer({ playerId: "p1", displayName: "Titular Uno", isSelected: false })],
        selectedIds: [],
        alreadyDeconvoked: [alreadyOut({ playerId: "x1", displayName: "Iker Ruiz" })],
      }),
    );

    expect(screen.getByText(NO_SELECTION_NOTICE)).toBeInTheDocument();
    expect(screen.getByText("Iker Ruiz")).toBeInTheDocument();
    expect(screen.getByText("Ya desconvocado")).toBeInTheDocument();
  });
});
