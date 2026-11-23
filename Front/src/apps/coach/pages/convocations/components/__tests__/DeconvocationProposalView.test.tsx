import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import DeconvocationProposalView from "../DeconvocationProposalView";
import type { DeconvokeProposal, PlayerProposal, ProposalDecision, ProposalOrderEntry } from "../../utils/deconvokeProposal";

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
    schedule: { upcoming: [], reservedIn: null, reservedNames: [], strongCount: 0, maxStrong: 0 },
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
    order: [],
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

  it("cuenta el partido actual y los 5 siguientes al hablar de los partidos difíciles", () => {
    renderView(
      proposal({
        rivalDifficulty: "easy",
        schedule: { upcoming: ["medium", "hard", "medium", "easy", "hard"], reservedIn: null, reservedNames: [], strongCount: 3, maxStrong: 1 },
      }),
    );

    expect(screen.getByText(/De los 6 partidos \(el actual y los 5 siguientes\), 2 son difíciles/)).toBeInTheDocument();
  });

  it("explica que se reservan los de menor nivel para el partido más difícil que viene", () => {
    renderView(
      proposal({
        rivalDifficulty: "hard",
        schedule: { upcoming: ["medium", "hard"], reservedIn: 2, reservedNames: ["Vargas", "Joao", "Fernando"], strongCount: 3, maxStrong: 0 },
      }),
    );

    expect(
      screen.getByText(/para el partido más difícil, dentro de 2 partidos, se reservan los jugadores de menor nivel \(Vargas, Joao, Fernando\)/i),
    ).toBeInTheDocument();
  });

  it("no habla de reservas cuando no hay partido más difícil por delante", () => {
    renderView(proposal({ schedule: { upcoming: ["medium", "easy"], reservedIn: null, reservedNames: [], strongCount: 3, maxStrong: 1 } }));

    expect(screen.queryByText(/se reservan los jugadores de menor nivel/i)).not.toBeInTheDocument();
  });

  it("cuenta como difícil el partido actual dentro de la ventana", () => {
    renderView(
      proposal({
        rivalDifficulty: "hard",
        schedule: { upcoming: ["medium", "medium", "medium", "medium", "medium"], reservedIn: null, reservedNames: [], strongCount: 3, maxStrong: 0 },
      }),
    );

    expect(screen.getByText(/De los 6 partidos \(el actual y los 5 siguientes\), 1 es difícil/)).toBeInTheDocument();
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

  it("muestra el puesto, el lugar y el encaje del propuesto por encaje en la tarjeta y en el detalle", () => {
    const fit = player(
      "p1",
      "Araque",
      {
        group: "proposed",
        criterion: "fit",
        reason: "Elegido: tiene peor encaje en su puesto (3.º de 3 en Mediocentro defensivo (3,1))",
        compare: "Frente a los otros 2 elegibles. El más parecido: Bruno: 1.º de 3 en Mediocentro defensivo (4,2)",
      },
      { detail: [{ rule: "Encaje en el puesto", value: "3.º de 3 en Mediocentro defensivo (3,1)", result: "decides" }] },
    );
    renderView(proposal({ players: [fit], selectedIds: ["p1"] }));

    expect(screen.getByText("Elegido por: encaje por rasgos")).toBeInTheDocument();
    expect(screen.getByText(/3\.º de 3 en Mediocentro defensivo \(3,1\)\)$/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Ver detalle de reglas"));
    expect(screen.getByText("Encaje en el puesto")).toBeInTheDocument();
    expect(screen.getByText("3.º de 3 en Mediocentro defensivo (3,1)")).toBeInTheDocument();
  });

  it("explica el orden de los criterios entre los elegibles", () => {
    renderView(proposal());

    expect(screen.getByText(/jornadas seguidas, excedente de convocatorias y encaje por rasgos/)).toBeInTheDocument();
  });
});

describe("DeconvocationProposalView — encaje en el puesto", () => {
  const fitInfo = { share: 0, place: 3, total: 3, positionLabel: "Central", position: "centerBack" as const, value: 3.4 };
  const fitContext = {
    positionFit: [
      {
        position: "centerBack" as const,
        confirmedWeekStart: null,
        isManual: false,
        weights: { traitOccupiesZone: "key" as const },
        candidates: [{ teamPlayerId: "p1", name: "Sergio", place: 1, fit: 3.4, trend: "same" as const }],
      },
    ],
    traitRatings: [
      { id: "r1", teamPlayerId: "p1", ratedAt: "2026-11-01T00:00:00", trend: "same" as const, levels: [{ traitKey: "traitOccupiesZone", level: 4 }] },
    ],
  };

  function withFit() {
    return proposal({
      players: [
        player("p1", "Sergio", { group: "proposed", criterion: "fit", reason: "Elegido: peor encaje" }, { fit: fitInfo }),
        player("p2", "Vargas", { group: "protected", protection: "injuryRest", reason: "Protegido" }, { fit: { ...fitInfo, place: 1 } }),
        player("p6", "Pedro", { group: "notChosen", reason: "No elegido" }),
      ],
    });
  }

  it("ofrece ver el encaje de los jugadores que tienen orden de encaje", () => {
    renderView(withFit(), { fitContext });

    expect(screen.getByRole("button", { name: "Ver encaje de Sergio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver encaje de Vargas" })).toBeInTheDocument();
  });

  it("no ofrece el encaje a quien no tiene orden de encaje", () => {
    renderView(withFit(), { fitContext });

    expect(screen.queryByRole("button", { name: "Ver encaje de Pedro" })).not.toBeInTheDocument();
  });

  it("no ofrece el encaje si la vista no recibe los datos de valoraciones", () => {
    renderView(withFit());

    expect(screen.queryByRole("button", { name: /Ver encaje/ })).not.toBeInTheDocument();
  });

  it("al pinchar abre el popup con las valoraciones del jugador", () => {
    renderView(withFit(), { fitContext });
    fireEvent.click(screen.getByRole("button", { name: "Ver encaje de Sergio" }));

    const dialog = screen.getByRole("dialog", { name: /Encaje de Sergio como Central/i });
    expect(within(dialog).getByText("Ocupa su zona y da apoyo")).toBeInTheDocument();
    expect(within(dialog).getByText("Nivel 4 de 5")).toBeInTheDocument();
  });

  it("el popup se cierra con Cerrar", () => {
    renderView(withFit(), { fitContext });
    fireEvent.click(screen.getByRole("button", { name: "Ver encaje de Sergio" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(screen.queryByRole("dialog", { name: /Encaje de Sergio/i })).not.toBeInTheDocument();
  });
});

function entry(rank: number, name: string, outcome: ProposalOrderEntry["outcome"], extra: Partial<ProposalOrderEntry> = {}): ProposalOrderEntry {
  return {
    rank,
    playerId: `o${rank}`,
    name,
    position: "Lateral",
    outcome,
    chips: ["5 seguidas", "Excedente 2", "Encaje 2,6", "Técnicas 0", "Asistencia 80%", "Nivel 6"],
    versusNext: { nextName: "Siguiente", criterion: "fit", text: `Va antes que Siguiente: encaje por rasgos (2,6 como Lateral frente a 3,3 como Mediapunta)` },
    ...extra,
  };
}

describe("DeconvocationProposalView — orden de desconvocatoria", () => {
  const order = [
    entry(1, "Vargas", "proposed"),
    entry(2, "Dani", "positionSkip"),
    entry(3, "Huguito", "stays", { position: "Mediapunta", versusNext: null }),
  ];

  it("lista a los elegibles numerados en el orden en que se desconvocan", () => {
    renderView(proposal({ order }));

    const list = within(screen.getByRole("list", { name: "Orden de desconvocatoria" }));
    const items = list.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText("Vargas")).toBeInTheDocument();
    expect(within(items[0]).getByText("1")).toBeInTheDocument();
    expect(within(items[2]).getByText("Huguito")).toBeInTheDocument();
  });

  it("muestra los criterios de cada jugador", () => {
    renderView(proposal({ order }));

    const first = within(screen.getAllByRole("listitem").find((li) => within(li).queryByText("Vargas")) as HTMLElement);
    expect(first.getByText("Encaje 2,6")).toBeInTheDocument();
    expect(first.getByText("5 seguidas")).toBeInTheDocument();
  });

  it("explica por qué cada uno va antes que el siguiente", () => {
    renderView(proposal({ order }));

    expect(
      screen.getAllByText("Va antes que Siguiente: encaje por rasgos (2,6 como Lateral frente a 3,3 como Mediapunta)").length,
    ).toBeGreaterThan(0);
  });

  it("marca la línea de corte tras el último desconvocado", () => {
    renderView(proposal({ order }));

    const cut = screen.getByRole("separator", { name: "Línea de corte" });
    expect(cut).toHaveTextContent("Línea de corte: se quedan los de abajo");
    expect(cut.previousElementSibling).toHaveTextContent("Vargas");
    expect(cut.nextElementSibling).toHaveTextContent("Dani");
  });

  it("indica al que se salta por el mínimo de su posición", () => {
    renderView(proposal({ order }));

    expect(screen.getByText("Se salta: mínimo de su posición")).toBeInTheDocument();
  });

  it("no muestra la lista cuando no hay elegibles", () => {
    renderView(proposal({ order: [] }));

    expect(screen.queryByRole("list", { name: "Orden de desconvocatoria" })).not.toBeInTheDocument();
  });

  describe("pestañas con la estimación de los partidos siguientes", () => {
    const estimated = (round: number, rival: string, date: string, difficulty: "easy" | "medium" | "hard", name: string) => ({
      match: { eventId: `upcoming-${round}`, round, label: `J${round}`, date, rival, difficulty },
      proposal: proposal({
        rivalDifficulty: difficulty,
        selectedIds: ["e1"],
        players: [
          player("e1", name, { group: "proposed", reason: `Elegido: ${name} descansa en la J${round}` }),
        ],
        alreadyDeconvoked: [],
      }),
    });
    const upcoming = [
      estimated(7, "Getafe", "2026-11-04", "hard", "Ramos"),
      estimated(8, "Rayo", "2026-11-11", "easy", "Cano"),
    ];

    it("no muestra pestañas si no hay partidos siguientes", () => {
      renderView(proposal());

      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    });

    it("muestra la propuesta actual y una pestaña por cada partido siguiente", () => {
      renderView(proposal(), { upcoming });

      const tabs = within(screen.getByRole("tablist", { name: "Propuesta por partido" })).getAllByRole("tab");
      expect(tabs.map((tab) => tab.textContent)).toEqual(["Actual", "J7 · Getafe", "J8 · Rayo"]);
      expect(screen.getByRole("tab", { name: "Actual" })).toHaveAttribute("aria-selected", "true");
    });

    it("al abrir una pestaña muestra su propuesta estimada con el aviso de estimación", () => {
      renderView(proposal(), { upcoming });

      fireEvent.click(screen.getByRole("tab", { name: "J7 · Getafe" }));

      expect(screen.getByText("Ramos")).toBeInTheDocument();
      expect(screen.queryByText("Sergio")).not.toBeInTheDocument();
      expect(screen.getByText(/Estimación para la J7 contra Getafe \(4 nov\)/)).toBeInTheDocument();
      expect(screen.getByText("Rival difícil")).toBeInTheDocument();
    });

    it("las pestañas estimadas no permiten aplicar la propuesta", () => {
      const handlers = renderView(proposal(), { upcoming });

      expect(screen.getByRole("button", { name: "Aplicar propuesta" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("tab", { name: "J8 · Rayo" }));

      expect(screen.queryByRole("button", { name: "Aplicar propuesta" })).not.toBeInTheDocument();
      expect(handlers.onApply).not.toHaveBeenCalled();
    });

    it("al volver a Actual se muestra la propuesta real con su acción de aplicar", () => {
      renderView(proposal(), { upcoming });

      fireEvent.click(screen.getByRole("tab", { name: "J7 · Getafe" }));
      fireEvent.click(screen.getByRole("tab", { name: "Actual" }));

      expect(screen.getByText("Sergio")).toBeInTheDocument();
      expect(screen.queryByText(/Estimación para/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Aplicar propuesta" })).toBeInTheDocument();
    });

    it("no usa tablas", () => {
      const { container } = render(
        <DeconvocationProposalView proposal={proposal()} upcoming={upcoming} loading={false} refreshing={false} applying={false} onBack={vi.fn()} onApply={vi.fn()} />,
      );

      expect(container.querySelector("table")).toBeNull();
    });
  });
});
