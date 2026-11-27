import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { GridCell, MatchColumn } from "../convocationMatchDetail.types";
import type { DeconvokeProposal, PlayerProposal, ProposalDecision } from "../../utils/deconvokeProposal";
import DeconvocationProposalView from "../DeconvocationProposalView";

const TECHNICAL: GridCell = { statusId: 5, excuseTypeId: null, statusName: "Deconvoke", excuseName: null };

const columns: MatchColumn[] = [{ eventId: "j1", label: "J1 · 4 oct", date: "2026-10-04", rival: null, isLeague: true }];
const grid = new Map([["j1", new Map([["p2", TECHNICAL]])]]);

function player(playerId: string, displayName: string, decision: ProposalDecision): PlayerProposal {
  return {
    playerId,
    displayName,
    position: "Central",
    positionRole: "centreBack",
    decision,
    detail: [],
    comparison: [],
    forced: false,
    calledCount: 1,
    startsCount: 0,
    startsDataAvailable: false,
    minRequiredCalls: 0,
    weeklyTraining: { totalTrainings: 0 },
  } as unknown as PlayerProposal;
}

const proposal = {
  rivalDifficulty: "medium",
  schedule: { upcoming: [], reservedIn: null, reservedNames: [], strongCount: 0, maxStrong: 0 },
  targetCount: 1,
  calledCount: 2,
  previousRivalResult: null,
  players: [
    player("p1", "Sergio", { group: "proposed", reason: "Elegido" }),
    player("p2", "Álvaro", { group: "notChosen", reason: "Sale otro" }),
  ],
  positionWarnings: [],
  alreadyDeconvoked: [],
  order: [],
} as unknown as DeconvokeProposal;

function renderView(props: Partial<React.ComponentProps<typeof DeconvocationProposalView>> = {}) {
  render(
    <DeconvocationProposalView
      proposal={proposal}
      history={{ columns, grid }}
      loading={false}
      refreshing={false}
      applying={false}
      onBack={vi.fn()}
      onApply={vi.fn()}
      {...props}
    />,
  );
}

const nameBox = () => screen.getByRole("textbox", { name: "Buscar jugador" });
const results = () => screen.getByRole("list", { name: "Resultados de la búsqueda" });

describe("DeconvocationProposalView · búsqueda", () => {
  it("sin buscar muestra las secciones habituales y ninguna lista de resultados", () => {
    renderView();

    expect(screen.getByText("Propuestos para desconvocar")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Resultados de la búsqueda" })).not.toBeInTheDocument();
  });

  it("al filtrar sustituye las secciones por los jugadores que cumplen, con su situación e historial", () => {
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Nunca desconvocados" }));

    expect(screen.queryByText("Propuestos para desconvocar")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 jugador");
    const items = within(results()).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Sergio");
    expect(items[0]).toHaveTextContent("Se desconvoca");
    expect(within(items[0]).getByRole("group", { name: "Historial de Sergio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nunca desconvocados" })).toHaveAttribute("aria-pressed", "true");
  });

  it("avisa cuando ningún jugador cumple la búsqueda", () => {
    renderView();

    fireEvent.change(nameBox(), { target: { value: "zzz" } });

    expect(screen.getByText("Ningún jugador cumple la búsqueda")).toBeInTheDocument();
  });

  it("«Limpiar» recupera las secciones", () => {
    renderView();
    fireEvent.change(nameBox(), { target: { value: "alvaro" } });
    expect(results()).toHaveTextContent("Álvaro");

    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));

    expect(nameBox()).toHaveValue("");
    expect(screen.getByText("Propuestos para desconvocar")).toBeInTheDocument();
  });

  it("permite ordenar por menos desconvocatorias", () => {
    renderView();

    fireEvent.change(screen.getByRole("combobox", { name: "Ordenar" }), { target: { value: "fewest" } });

    expect(within(results()).getAllByRole("listitem")[0]).toHaveTextContent("Sergio");
  });

  it("no ofrece búsqueda sin historial ni en las estimaciones", () => {
    renderView({ history: undefined });
    expect(screen.queryByRole("textbox", { name: "Buscar jugador" })).not.toBeInTheDocument();
  });

  it("oculta la búsqueda y sus resultados en la pestaña de un próximo partido", () => {
    renderView({
      upcoming: [
        {
          match: { eventId: "n1", round: 9, label: "J9", rival: "Rival", date: "2026-10-21", difficulty: "medium", winProbability: 0.5, rivalPosition: null },
          proposal,
        },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Nunca desconvocados" }));

    fireEvent.click(screen.getByRole("tab", { name: /J9/ }));

    expect(screen.queryByRole("textbox", { name: "Buscar jugador" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Resultados de la búsqueda" })).not.toBeInTheDocument();
    expect(screen.getByText("Propuestos para desconvocar")).toBeInTheDocument();
  });
});
