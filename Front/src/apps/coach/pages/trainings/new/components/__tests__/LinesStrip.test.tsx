import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TacticalBoardState } from "../../hooks/useTacticalBoard";
import LinesStrip from "../LinesStrip";
import { DEFAULT_LINE_WIDTH, LINE_WIDTH_OPTIONS } from "../../constants";

function makeBoard(overrides: Partial<TacticalBoardState> = {}): TacticalBoardState {
  return {
    activeLineKind: null,
    setActiveLineKind: vi.fn(),
    activeLineColor: "#ffffff",
    setActiveLineColor: vi.fn(),
    activeLineWidth: DEFAULT_LINE_WIDTH,
    setActiveLineWidth: vi.fn(),
    placedLines: [],
    setPlacedLines: vi.fn(),
    ...overrides,
  } as TacticalBoardState;
}

describe("LinesStrip - grosor de líneas", () => {
  it("ofrece un botón por cada grosor disponible", () => {
    render(<LinesStrip board={makeBoard()} />);

    LINE_WIDTH_OPTIONS.forEach((option) => {
      expect(screen.getByRole("button", { name: `Grosor ${option.label.toLowerCase()}` })).toBeInTheDocument();
    });
  });

  it("marca como activo el grosor con el que se va a dibujar", () => {
    render(<LinesStrip board={makeBoard({ activeLineWidth: 3 })} />);

    expect(screen.getByRole("button", { name: "Grosor gruesa" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Grosor normal" })).toHaveAttribute("aria-pressed", "false");
  });

  it("cambia el grosor activo al pulsar otro grosor", () => {
    const setActiveLineWidth = vi.fn();
    render(<LinesStrip board={makeBoard({ setActiveLineWidth })} />);

    fireEvent.click(screen.getByRole("button", { name: "Grosor muy gruesa" }));

    expect(setActiveLineWidth).toHaveBeenCalledWith(5);
  });
});
