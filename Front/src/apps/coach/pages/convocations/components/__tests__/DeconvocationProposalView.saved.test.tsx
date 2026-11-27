import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { DeconvokeProposal, PlayerProposal, ProposalDecision } from "../../utils/deconvokeProposal";
import DeconvocationProposalView from "../DeconvocationProposalView";
import type { SavedProposalsController } from "../SavedProposals";

function player(playerId: string, displayName: string, group: ProposalDecision["group"]): PlayerProposal {
  return {
    playerId,
    displayName,
    position: "Central",
    positionRole: "centreBack",
    decision: { group, reason: "Motivo" },
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

function proposal(players = [player("p1", "Sergio", "proposed"), player("p2", "Pedro", "proposed"), player("p3", "Hugo", "notChosen")]) {
  return {
    rivalDifficulty: "medium",
    schedule: { upcoming: [], reservedIn: null, reservedNames: [], strongCount: 0, maxStrong: 0 },
    targetCount: 2,
    calledCount: 3,
    previousRivalResult: null,
    players,
    positionWarnings: [],
    alreadyDeconvoked: [],
    order: [
      { rank: 1, playerId: "p2", name: "Pedro", position: "Central", outcome: "proposed", chips: [], versusNext: null },
      { rank: 2, playerId: "p1", name: "Sergio", position: "Central", outcome: "proposed", chips: [], versusNext: null },
    ],
  } as unknown as DeconvokeProposal;
}

const NAMES: Record<string, string> = { p1: "Sergio", p2: "Pedro", p3: "Hugo", p4: "Nico" };

function controller(overrides: Partial<SavedProposalsController> = {}): SavedProposalsController {
  return {
    items: [],
    loading: false,
    loadFailed: false,
    reload: vi.fn(),
    save: vi.fn().mockResolvedValue(true),
    remove: vi.fn().mockResolvedValue(true),
    apply: vi.fn().mockResolvedValue(undefined),
    playerName: (id) => NAMES[id] ?? null,
    notCalledIds: new Set<string>(),
    ...overrides,
  };
}

function saved(id: string, name: string, teamPlayerIds: string[]) {
  return { id, name, teamPlayerIds, createdOn: "2026-11-27T10:00:00Z" };
}

function renderView(value: SavedProposalsController, props: Partial<React.ComponentProps<typeof DeconvocationProposalView>> = {}) {
  render(
    <DeconvocationProposalView
      proposal={proposal()}
      saved={value}
      loading={false}
      refreshing={false}
      applying={false}
      onBack={vi.fn()}
      onApply={vi.fn()}
      {...props}
    />,
  );
}

const card = (name: string) => screen.getByRole("article", { name });

describe("DeconvocationProposalView · guardar propuesta", () => {
  it("guarda los propuestos en el orden de desconvocatoria con el nombre sugerido", async () => {
    const value = controller({ items: [saved("s1", "Propuesta 1", ["p3"])] });
    renderView(value);

    fireEvent.click(screen.getByRole("button", { name: "Guardar propuesta" }));
    const dialog = screen.getByRole("dialog", { name: "Guardar propuesta" });
    expect(within(dialog).getByRole("textbox", { name: "Nombre" })).toHaveValue("Propuesta 2");
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));

    expect(value.save).toHaveBeenCalledWith("Propuesta 2", ["p2", "p1"]);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("no permite guardar sin nombre", () => {
    renderView(controller());
    fireEvent.click(screen.getByRole("button", { name: "Guardar propuesta" }));

    fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), { target: { value: "   " } });

    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("mantiene el diálogo abierto si no se puede guardar", async () => {
    const value = controller({ save: vi.fn().mockResolvedValue(false) });
    renderView(value);
    fireEvent.click(screen.getByRole("button", { name: "Guardar propuesta" }));

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled());
    expect(screen.getByRole("dialog", { name: "Guardar propuesta" })).toBeInTheDocument();
  });

  it("no se puede guardar sin jugadores propuestos", () => {
    renderView(controller(), { proposal: proposal([player("p3", "Hugo", "notChosen")]) });

    expect(screen.getByRole("button", { name: "Guardar propuesta" })).toBeDisabled();
  });

  it("sin control de guardado no ofrece guardar ni muestra la lista", () => {
    renderView(controller(), { saved: undefined });

    expect(screen.queryByRole("button", { name: "Guardar propuesta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Propuestas guardadas" })).not.toBeInTheDocument();
  });

  it("oculta guardar y las guardadas en la estimación de un próximo partido", () => {
    renderView(controller({ items: [saved("s1", "Propuesta 1", ["p1"])] }), {
      upcoming: [
        {
          match: { eventId: "n1", round: 9, label: "J9", rival: "Rival", date: "2026-12-05", difficulty: "medium", winProbability: 0.5, rivalPosition: null },
          proposal: proposal(),
        },
      ],
    });

    fireEvent.click(screen.getByRole("tab", { name: /J9/ }));

    expect(screen.queryByRole("button", { name: "Guardar propuesta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Propuestas guardadas" })).not.toBeInTheDocument();
  });
});

describe("DeconvocationProposalView · propuestas guardadas", () => {
  const two = () => [saved("s1", "Sin Pedro", ["p1"]), saved("s2", "Sin Sergio", ["p2", "gone"])];

  it("lista cada propuesta con sus jugadores y avisa de los que ya no están", () => {
    renderView(controller({ items: two() }));

    expect(card("Sin Pedro")).toHaveTextContent("Sergio");
    expect(card("Sin Pedro")).toHaveTextContent("Guardada el 27 nov");
    expect(card("Sin Sergio")).toHaveTextContent("Pedro");
    expect(card("Sin Sergio")).toHaveTextContent("1 jugador ya no está en la plantilla");
  });

  it("aplicar pide confirmación indicando quién sale y quién sigue fuera", async () => {
    const value = controller({ items: two(), notCalledIds: new Set(["p4"]) });
    renderView(value);

    fireEvent.click(screen.getByRole("button", { name: "Aplicar Sin Sergio" }));
    const dialog = screen.getByRole("dialog", { name: "Aplicar «Sin Sergio»" });
    expect(dialog).toHaveTextContent("Se desconvocará por decisión técnica a: Pedro.");
    expect(dialog).toHaveTextContent("Ya están desconvocados y seguirán fuera: Nico.");
    expect(dialog).toHaveTextContent("La convocatoria no se publica.");
    expect(value.apply).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar" }));

    expect(value.apply).toHaveBeenCalledWith(["p2"]);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("cancelar no aplica nada", () => {
    const value = controller({ items: two() });
    renderView(value);
    fireEvent.click(screen.getByRole("button", { name: "Aplicar Sin Pedro" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(value.apply).not.toHaveBeenCalled();
  });

  it("marca como aplicada la que ya tiene a todos sus jugadores fuera y no deja aplicarla", () => {
    renderView(controller({ items: two(), notCalledIds: new Set(["p2"]) }));

    expect(card("Sin Sergio")).toHaveTextContent("Aplicada");
    expect(screen.getByRole("button", { name: "Aplicar Sin Sergio" })).toBeDisabled();
    expect(card("Sin Pedro")).not.toHaveTextContent("Aplicada");
  });

  it("borrar pide confirmación", async () => {
    const value = controller({ items: two() });
    renderView(value);

    fireEvent.click(screen.getByRole("button", { name: "Borrar Sin Pedro" }));
    expect(value.remove).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog", { name: "Borrar «Sin Pedro»" })).getByRole("button", { name: "Borrar" }));

    expect(value.remove).toHaveBeenCalledWith("s1");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("si no se pueden cargar ofrece reintentar", () => {
    const value = controller({ loadFailed: true });
    renderView(value);

    expect(screen.getByText("No se pudieron cargar las propuestas guardadas.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(value.reload).toHaveBeenCalled();
  });

  it("sin propuestas guardadas no muestra la sección", () => {
    renderView(controller());

    expect(screen.queryByRole("region", { name: "Propuestas guardadas" })).not.toBeInTheDocument();
  });
});
