import { describe, expect, it } from "vitest";
import { detectBoardViewport } from "../boardViewport";
import type { TacticalBoardSnapshot } from "../../types";

function snapshot(overrides: Partial<TacticalBoardSnapshot> = {}): TacticalBoardSnapshot {
  return {
    placedChapas: {},
    chapaPetoById: {},
    placedSpaces: [],
    placedMaterials: [],
    placedLines: [],
    placedTexts: [],
    ...overrides,
  };
}

describe("detectBoardViewport", () => {
  it("usa el medio campo derecho cuando todos los elementos están en él", () => {
    const result = detectBoardViewport(
      snapshot({
        placedChapas: { p1: { x: 20, y: 30 }, p2: { x: 80, y: 60 } },
        placedLines: [{ id: "l1", kind: "arrow", color: "#fff", x1: 10, y1: 10, x2: 60, y2: 50 }],
      }),
    );
    expect(result).toBe("right");
  });

  it("usa el medio campo izquierdo cuando todos los elementos tienen x negativa", () => {
    const result = detectBoardViewport(
      snapshot({
        placedChapas: { p1: { x: -20, y: 30 } },
        placedMaterials: [{ id: "m1", kind: "conos", x: -60, y: 40, rotation: 0 }],
      }),
    );
    expect(result).toBe("left");
  });

  it("usa el campo completo cuando hay elementos en ambas mitades", () => {
    const result = detectBoardViewport(
      snapshot({ placedChapas: { p1: { x: -30, y: 30 }, p2: { x: 30, y: 30 } } }),
    );
    expect(result).toBe("full");
  });

  it("usa el campo completo cuando una línea cruza el medio campo", () => {
    const result = detectBoardViewport(
      snapshot({
        placedLines: [{ id: "l1", kind: "straight", color: "#fff", x1: -40, y1: 10, x2: 40, y2: 10 }],
      }),
    );
    expect(result).toBe("full");
  });

  it("usa el campo completo cuando un espacio sobresale de la línea de medio campo", () => {
    const result = detectBoardViewport(
      snapshot({
        placedSpaces: [
          { id: "s1", kind: "rectangle", x: 5, y: 50, scaleX: 2, scaleY: 2, rotation: 0, locked: false },
        ],
      }),
    );
    expect(result).toBe("full");
  });

  it("mantiene medio campo cuando una chapa está pegada a la línea de medio campo", () => {
    const result = detectBoardViewport(snapshot({ placedChapas: { p1: { x: 1, y: 50 } } }));
    expect(result).toBe("right");
  });
});
