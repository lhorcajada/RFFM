import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DeconvocationProposalView from "../DeconvocationProposalView";
import type { DeconvokeProposal, ProposalOrderEntry } from "../../utils/deconvokeProposal";

function entry(rank: number, id: string, name: string, outcome: ProposalOrderEntry["outcome"], overrides: Partial<ProposalOrderEntry> = {}): ProposalOrderEntry {
  return { rank, playerId: id, name, position: "Central", outcome, chips: [], versusNext: null, ...overrides };
}

function proposal(overrides: Partial<DeconvokeProposal> = {}): DeconvokeProposal {
  return {
    generatedAt: "2026-10-14T10:00:00.000Z",
    rivalDifficulty: "medium",
    schedule: { upcoming: [], reservedIn: null, reservedNames: [], strongCount: 0, maxStrong: 0 },
    targetCount: 1,
    calledCount: 3,
    selectedIds: ["p1"],
    previousRivalResult: null,
    players: [
      {
        playerId: "p1",
        displayName: "Erik",
        position: "Central",
        positionRole: "centreBack",
        isSelected: true,
        forced: false,
        locked: false,
        score: 0,
        factors: [],
        summary: "",
        calledCount: 5,
        startsCount: 1,
        startsDataAvailable: true,
        minRequiredCalls: 4,
        weeklyTraining: {
          totalTrainings: 0,
          attendedTrainings: 0,
          weightedAttendedTrainings: 0,
          attendedTrainingsSeason: 0,
          weightedAttendedTrainingsSeason: 0,
          totalTrainingsSeason: 0,
          knownUnavailableTrainings: 0,
        },
        decision: { group: "proposed", reason: "Elegido" },
        detail: [],
        comparison: [],
      },
    ],
    positionWarnings: [],
    alreadyDeconvoked: [],
    order: [entry(1, "p1", "Erik", "proposed"), entry(2, "p2", "Santi", "stays"), entry(3, "p3", "Hugo", "stays")],
    ...overrides,
  };
}

function renderView(value: DeconvokeProposal, props: Partial<React.ComponentProps<typeof DeconvocationProposalView>> = {}) {
  const handlers = { onBack: vi.fn(), onApply: vi.fn() };
  render(<DeconvocationProposalView proposal={value} loading={false} refreshing={false} applying={false} {...handlers} {...props} />);
  return handlers;
}

describe("DeconvocationProposalView — orden manual", () => {
  it("sin manejador de movimiento no ofrece mover a los jugadores", () => {
    renderView(proposal());

    expect(screen.queryByRole("button", { name: /Subir a/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Bajar a/ })).not.toBeInTheDocument();
  });

  it("ofrece subir y bajar a cada jugador del orden", () => {
    renderView(proposal(), { onMoveInOrder: vi.fn() });

    expect(screen.getByRole("button", { name: "Subir a Santi" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Bajar a Santi" })).toBeEnabled();
  });

  it("no se puede subir al primero ni bajar al último", () => {
    renderView(proposal(), { onMoveInOrder: vi.fn() });

    expect(screen.getByRole("button", { name: "Subir a Erik" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bajar a Hugo" })).toBeDisabled();
  });

  it("avisa de qué jugador se mueve y en qué sentido", () => {
    const onMoveInOrder = vi.fn();
    renderView(proposal(), { onMoveInOrder });

    fireEvent.click(screen.getByRole("button", { name: "Bajar a Erik" }));
    fireEvent.click(screen.getByRole("button", { name: "Subir a Hugo" }));

    expect(onMoveInOrder).toHaveBeenNthCalledWith(1, "p1", "down");
    expect(onMoveInOrder).toHaveBeenNthCalledWith(2, "p3", "up");
  });

  it("con orden manual lo indica y permite volver a la propuesta automática", () => {
    const onResetOrder = vi.fn();
    renderView(proposal({ isManual: true, manualWarnings: [] }), { onMoveInOrder: vi.fn(), onResetOrder });

    expect(screen.getByText(/Orden manual/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Volver a la propuesta automática/ }));
    expect(onResetOrder).toHaveBeenCalledTimes(1);
  });

  it("con la propuesta automática no muestra el aviso de orden manual", () => {
    renderView(proposal(), { onMoveInOrder: vi.fn(), onResetOrder: vi.fn() });

    expect(screen.queryByText(/Orden manual/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Volver a la propuesta automática/ })).not.toBeInTheDocument();
  });

  it("lista los avisos de los protegidos elegidos a mano", () => {
    renderView(proposal({ isManual: true, manualWarnings: ["Vargas: Protegido: desconvocado hace 3 jornadas"] }), {
      onMoveInOrder: vi.fn(),
      onResetOrder: vi.fn(),
    });

    expect(screen.getByText(/Vargas: Protegido: desconvocado hace 3 jornadas/)).toBeInTheDocument();
  });

  it("muestra el motivo de la protección de un protegido que aparece en el orden manual", () => {
    renderView(
      proposal({
        isManual: true,
        manualWarnings: [],
        order: [entry(1, "p1", "Erik", "proposed"), entry(2, "p2", "Vargas", "stays", { heldReason: "Protegido: desconvocado hace 3 jornadas" })],
      }),
      { onMoveInOrder: vi.fn(), onResetOrder: vi.fn() },
    );

    expect(screen.getByText("Protegido: desconvocado hace 3 jornadas")).toBeInTheDocument();
  });
});
