import { describe, expect, it } from "vitest";
import { planDrawingFit, type DrawingMeasure } from "../sessionPrintLayout";

const PAGE = 1000;
const options = { pageHeight: PAGE, minDrawingHeight: 200, safety: 0 };

function measure(overrides: Partial<DrawingMeasure> = {}): DrawingMeasure {
  return { itemTop: 0, visualTop: 300, overhead: 20, drawingHeight: 500, ...overrides };
}

describe("planDrawingFit", () => {
  it("mantiene el tamaño del dibujo cuando cabe en la página de su texto", () => {
    const [plan] = planDrawingFit([measure({ visualTop: 300, drawingHeight: 500 })], options);
    expect(plan).toEqual({ height: 500, breakBeforeItem: false, breakBeforeVisual: false });
  });

  it("encoge el dibujo al espacio que queda en la página de su texto", () => {
    const [plan] = planDrawingFit([measure({ visualTop: 600, drawingHeight: 500 })], options);
    expect(plan).toEqual({ height: 380, breakBeforeItem: false, breakBeforeVisual: false });
  });

  it("lleva el ejercicio entero a la página siguiente cuando el dibujo no cabe ni encogido", () => {
    const [plan] = planDrawingFit(
      [measure({ itemTop: 700, visualTop: 900, drawingHeight: 500 })],
      options,
    );
    expect(plan).toEqual({ height: 500, breakBeforeItem: true, breakBeforeVisual: false });
  });

  it("encoge el dibujo tras mover el ejercicio si texto y dibujo no caben juntos en una página", () => {
    const [plan] = planDrawingFit(
      [measure({ itemTop: 500, visualTop: 900, drawingHeight: 700 })],
      options,
    );
    expect(plan).toEqual({ height: 580, breakBeforeItem: true, breakBeforeVisual: false });
  });

  it("pasa solo el dibujo a la página siguiente cuando el texto del ejercicio ocupa varias páginas", () => {
    const [plan] = planDrawingFit(
      [measure({ itemTop: 200, visualTop: 1900, drawingHeight: 500 })],
      options,
    );
    expect(plan).toEqual({ height: 500, breakBeforeItem: false, breakBeforeVisual: true });
  });

  it("tiene en cuenta el espacio liberado al encoger dibujos anteriores", () => {
    const plans = planDrawingFit(
      [
        measure({ itemTop: 0, visualTop: 600, drawingHeight: 500 }),
        // Without the first shrink (−120) this one would start at 1300; with it, at 1180.
        measure({ itemTop: 1200, visualTop: 1300, drawingHeight: 700 }),
      ],
      options,
    );
    expect(plans[1]).toEqual({ height: 700, breakBeforeItem: false, breakBeforeVisual: false });
  });

  it("aplica el margen de seguridad al espacio restante", () => {
    const [plan] = planDrawingFit([measure({ visualTop: 600, drawingHeight: 500 })], {
      ...options,
      safety: 30,
    });
    expect(plan.height).toBe(350);
  });
});
