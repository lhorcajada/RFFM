import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import DeconvocationProposalView from "../DeconvocationProposalView";
import type { DeconvokeProposal, PlayerProposal, ProposalDecision } from "../../utils/deconvokeProposal";

function player(id: string, name: string, decision: ProposalDecision, overrides: Partial<PlayerProposal> = {}): PlayerProposal {
  return {
    playerId: id,
    displayName: name,
    position: "Central",
    positionRole: "centreBack",
    isSelected: decision.group === "proposed",
    forced: false,
    locked: false,
    score: 0,
    factors: [],
    summary: "",
    calledCount: 7,
    startsCount: 1,
    startsDataAvailable: true,
    minRequiredCalls: 6,
    weeklyTraining: {
      totalTrainings: 2,
      attendedTrainings: 1,
      weightedAttendedTrainings: 1,
      attendedTrainingsSeason: 1,
      weightedAttendedTrainingsSeason: 1,
      totalTrainingsSeason: 2,
      knownUnavailableTrainings: 0,
    },
    decision,
    detail: [],
    comparison: [],
    ...overrides,
  };
}

function proposal(overrides: Partial<DeconvokeProposal> = {}): DeconvokeProposal {
  return {
    generatedAt: "2026-10-14T10:00:00.000Z",
    rivalDifficulty: "hard",
    targetCount: 2,
    calledCount: 20,
    selectedIds: ["p1"],
    previousRivalResult: null,
    players: [
      player(
        "p1",
        "Sergio",
        {
          group: "proposed",
          criterion: "consecutive",
          reason: "Elegido: lleva 5 jornadas seguidas convocado sin descansar",
          compare: "Pedro lleva 4",
        },
        {
          detail: [
            { rule: "Desconvocado hace poco", value: "Sin desconvocatorias técnicas (ventana 5)", result: "doesNotProtect" },
            { rule: "Jornadas seguidas convocado", value: "5", result: "decides" },
          ],
          comparison: [
            { playerId: "p6", name: "Pedro", position: "Central", outcome: "decides", verdict: "Decide: jornadas seguidas (5 frente a 4)" },
            { playerId: "p7", name: "Hugo", position: "Central", outcome: "tie", verdict: "Empate en todos los criterios" },
            { playerId: "p5", name: "Dani", position: "Lateral", outcome: "position", verdict: "Se queda por el mínimo de su posición" },
          ],
        },
      ),
      player("p2", "Vargas", { group: "protected", protection: "injuryRest", reason: "Protegido: no vino la jornada anterior por lesión" }),
      player("p3", "Iván", { group: "protected", protection: "technicalWindow", reason: "Protegido: desconvocado hace 3 jornadas" }),
      player("p4", "Lucas", { group: "protected", protection: "minCalls", reason: "Protegido: le falta 1 convocatoria para llegar al mínimo exigido (10)" }),
      player("p5", "Dani", { group: "protected", protection: "position", reason: "Protegido: quedan 3 de 3 laterales disponibles" }),
      player("p6", "Pedro", { group: "notChosen", reason: "Sergio lleva más jornadas seguidas convocado (5 frente a 4)" }),
    ],
    positionWarnings: [],
    alreadyDeconvoked: [{ playerId: "x1", displayName: "Marcos M.", position: "Lateral", positionRole: "fullBack" }],
    ...overrides,
  };
}

function renderView(value: DeconvokeProposal, props: Partial<React.ComponentProps<typeof DeconvocationProposalView>> = {}) {
  const handlers = { onBack: vi.fn(), onApply: vi.fn(), onRefresh: vi.fn(), onOpenRules: vi.fn() };
  render(
    <DeconvocationProposalView
      proposal={value}
      loading={false}
      refreshing={false}
      applying={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe("DeconvocationProposalView", () => {
  it("muestra el objetivo, los ya desconvocados y la plantilla", () => {
    renderView(proposal());

    expect(screen.getByText("Propuesta automática de desconvocatoria")).toBeInTheDocument();
    expect(screen.getByText(/Objetivo: 2 desconvocado\(s\)/)).toBeInTheDocument();
    expect(screen.getByText(/Plantilla: 20 jugadores/)).toBeInTheDocument();
  });

  it("muestra al propuesto con el criterio que decidió y frente a quién", () => {
    renderView(proposal());

    expect(screen.getByText("Sergio")).toBeInTheDocument();
    expect(screen.getByText("Elegido: lleva 5 jornadas seguidas convocado sin descansar")).toBeInTheDocument();
    expect(screen.getByText("Pedro lleva 4")).toBeInTheDocument();
    expect(screen.getByText("Elegido por: jornadas seguidas")).toBeInTheDocument();
  });

  it("marca como obligatorio al jugador forzado por una regla", () => {
    const forced = player("p1", "Sergio", { group: "proposed", criterion: "mandatory", reason: "Obligatorio: Lesionado" }, { forced: true });
    renderView(proposal({ players: [forced], selectedIds: ["p1"] }));

    expect(screen.getByText("Obligatorio")).toBeInTheDocument();
    expect(screen.getByText("Elegido por: regla obligatoria")).toBeInTheDocument();
  });

  it("ofrece un desplegable con el detalle de reglas de cada propuesto, cerrado por defecto", () => {
    renderView(proposal());

    const summary = screen.getByText("Ver detalle de reglas");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    fireEvent.click(summary);
    expect(summary.closest("details")).toHaveAttribute("open");
    expect(screen.getByText("Jornadas seguidas convocado")).toBeInTheDocument();
    expect(screen.getByText("Decide")).toBeInTheDocument();
    expect(screen.getByText("No protege")).toBeInTheDocument();
  });

  it("compara al propuesto con cada elegible dentro del desplegable", () => {
    renderView(proposal());

    const section = within(screen.getByRole("group", { name: "Frente a los demás elegibles" }));
    expect(section.getByText("Pedro")).toBeInTheDocument();
    expect(section.getByText("Decide: jornadas seguidas (5 frente a 4)")).toBeInTheDocument();
    expect(section.getByText("Empate en todos los criterios")).toBeInTheDocument();
    expect(section.getByText("Se queda por el mínimo de su posición")).toBeInTheDocument();
  });

  it("no muestra la comparación cuando el propuesto no tiene elegibles con los que compararse", () => {
    renderView(proposal({ players: [player("p1", "Sergio", { group: "proposed", criterion: "mandatory", reason: "Obligatorio: Lesionado" }, { forced: true, detail: [{ rule: "Regla obligatoria", value: "Lesionado", result: "mandatory" }] })], selectedIds: ["p1"] }));

    expect(screen.queryByRole("group", { name: "Frente a los demás elegibles" })).not.toBeInTheDocument();
  });

  it("agrupa a los protegidos por motivo", () => {
    renderView(proposal());

    const rest = within(screen.getByRole("group", { name: "Descansaron o desconvocados hace poco" }));
    expect(rest.getByText("Vargas")).toBeInTheDocument();
    expect(rest.getByText("Protegido: no vino la jornada anterior por lesión")).toBeInTheDocument();
    expect(rest.getByText("Iván")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Mínimo de convocatorias" })).getByText("Lucas")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Mínimo por posición" })).getByText("Dani")).toBeInTheDocument();
  });

  it("muestra al protegido por otro motivo (por ejemplo, un problema familiar)", () => {
    const nico = player("p8", "Nico", { group: "protected", protection: "otherCause", reason: "Protegido: desconvocado hace 1 jornada por problema familiar" });
    renderView(proposal({ players: [...proposal().players, nico] }));

    const rest = within(screen.getByRole("group", { name: "Descansaron o desconvocados hace poco" }));
    expect(rest.getByText("Nico")).toBeInTheDocument();
    expect(rest.getByText("Protegido: desconvocado hace 1 jornada por problema familiar")).toBeInTheDocument();
  });

  it("nunca esconde a un protegido: si su motivo no tiene grupo lo muestra en «Otros protegidos»", () => {
    const raro = player("p9", "Raro", { group: "protected", reason: "Protegido: motivo sin clasificar" });
    renderView(proposal({ players: [...proposal().players, raro] }));

    expect(within(screen.getByRole("group", { name: "Otros protegidos" })).getByText("Raro")).toBeInTheDocument();
  });

  it("no muestra grupos de protegidos vacíos", () => {
    renderView(proposal({ players: [proposal().players[0]] }));

    expect(screen.queryByRole("group", { name: "Mínimo de convocatorias" })).not.toBeInTheDocument();
  });

  it("muestra a los elegibles no elegidos con el motivo de la preferencia", () => {
    renderView(proposal());

    const notChosen = within(screen.getByRole("group", { name: "Elegibles no elegidos" }));
    expect(notChosen.getByText("Pedro")).toBeInTheDocument();
    expect(notChosen.getByText("Sergio lleva más jornadas seguidas convocado (5 frente a 4)")).toBeInTheDocument();
  });

  it("muestra a los ya desconvocados", () => {
    renderView(proposal());

    const group = within(screen.getByRole("group", { name: "Jugadores ya desconvocados" }));
    expect(group.getByText("Marcos M.")).toBeInTheDocument();
    expect(group.getByText("Ya desconvocado")).toBeInTheDocument();
  });

  it("explica cómo se ha decidido, con el efecto de un rival difícil", () => {
    renderView(proposal({ rivalDifficulty: "hard" }));

    expect(screen.getByText("Cómo se ha decidido")).toBeInTheDocument();
    expect(screen.getByText("Rival difícil")).toBeInTheDocument();
    expect(screen.getByText(/salen primero los de menor nivel/)).toBeInTheDocument();
  });

  it("dice que el nivel no influye cuando el rival no es difícil", () => {
    renderView(proposal({ rivalDifficulty: "medium" }));

    expect(screen.getByText("Rival medio")).toBeInTheDocument();
    expect(screen.getByText(/nivel de los jugadores no influye/)).toBeInTheDocument();
  });

  it("cuenta cuántos jugadores protege cada paso del embudo", () => {
    renderView(proposal());

    expect(screen.getByText(/3 jugadores quedan fuera de la propuesta/)).toBeInTheDocument();
    expect(screen.getByText(/1 jugador se queda para mantener el mínimo de su posición/)).toBeInTheDocument();
  });

  it("no ofrece imprimir la propuesta", () => {
    renderView(proposal());

    expect(screen.queryByRole("button", { name: /imprimir/i })).not.toBeInTheDocument();
  });

  it("avisa de los mínimos de posición sin cubrir", () => {
    renderView(proposal({ positionWarnings: [{ requirement: "centreBack", label: "Centrales", required: 3, remaining: 2 }] }));

    expect(screen.getByText("Mínimos de posición sin cubrir")).toBeInTheDocument();
    expect(screen.getByText("Centrales: quedan 2 de 3")).toBeInTheDocument();
  });

  it("avisa de que no hace falta desconvocar cuando no hay propuestos", () => {
    renderView(proposal({ players: [proposal().players[5]], selectedIds: [] }));

    expect(screen.getByText("No hace falta desconvocar jugadores con las reglas actuales.")).toBeInTheDocument();
  });

  it("muestra un estado vacío sin convocados que evaluar", () => {
    renderView(proposal({ players: [], alreadyDeconvoked: [], selectedIds: [] }));

    expect(screen.getByText("No hay convocados para evaluar.")).toBeInTheDocument();
  });

  it("los botones de cabecera llaman a sus acciones", () => {
    const handlers = renderView(proposal());

    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    fireEvent.click(screen.getByRole("button", { name: "Reglas" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar propuesta" }));

    expect(handlers.onBack).toHaveBeenCalled();
    expect(handlers.onRefresh).toHaveBeenCalled();
    expect(handlers.onOpenRules).toHaveBeenCalled();
    expect(handlers.onApply).toHaveBeenCalled();
  });

  it("oculta Actualizar y Reglas cuando no se pueden usar", () => {
    renderView(proposal(), { onRefresh: undefined, onOpenRules: undefined });

    expect(screen.queryByRole("button", { name: "Actualizar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reglas" })).not.toBeInTheDocument();
  });

  it("no permite aplicar sin propuestos", () => {
    renderView(proposal({ players: [proposal().players[5]], selectedIds: [] }));

    expect(screen.getByRole("button", { name: "Aplicar propuesta" })).toBeDisabled();
  });
});
