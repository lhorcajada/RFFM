import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConvocationMatchActionBar from "../ConvocationMatchActionBar";
import { CONVOCATION_TAB } from "../convocationMatchDetail.types";

const baseProps = {
  teamId: "team-1",
  tab: CONVOCATION_TAB.Convocatoria,
  eventId: "event-1",
  printing: false,
  convocationConfirmed: true,
  onBack: vi.fn(),
  onOpenEvent: vi.fn(),
  onSaveConvocation: vi.fn(),
  onPrint: vi.fn(),
  onViewConvocation: vi.fn(),
  readOnly: true,
};

describe("ConvocationMatchActionBar — solo lectura (jugador/familiar)", () => {
  it("solo muestra Volver cuando no hay partido en directo disponible", () => {
    render(<ConvocationMatchActionBar {...baseProps} />);

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /volver/i })).toBeInTheDocument();
  });

  it("no muestra Ir al evento, Guardar, PDF ni Ver convocatoria", () => {
    render(<ConvocationMatchActionBar {...baseProps} onOpenLiveMatch={vi.fn()} />);

    for (const name of [/ir al evento/i, /guardar/i, /pdf/i, /ver convocatoria/i]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("muestra Partido en directo junto a Volver cuando se ofrece", () => {
    render(<ConvocationMatchActionBar {...baseProps} onOpenLiveMatch={vi.fn()} />);

    expect(screen.getByRole("button", { name: /partido en directo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /volver/i })).toBeInTheDocument();
  });
});
