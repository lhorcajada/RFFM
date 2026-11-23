import { afterEach, describe, expect, it, vi } from "vitest";
import { describeOverflow, findOverflowingSheets, legendFits, measureSheetFit } from "../sheetMeasure";
import type { SheetContent } from "../exerciseSheet";
import type { Exercise } from "../../../types/training";

function content(overrides: Partial<SheetContent> = {}): SheetContent {
  return {
    espacio: null,
    turnoMinutos: null,
    nivelDibujo: null,
    queSeHace: "",
    reglas: [],
    puntos: [],
    rotaciones: [],
    montaje: [],
    nivelesColumnas: [],
    niveles: [],
    modeloDeJuego: "",
    ...overrides,
  };
}

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "ex-1",
    name: "Rondo",
    tipo: "Global",
    objetivo: "",
    nivelesColumnas: [],
    niveles: [],
    logistica: "",
    descripcion: "",
    ...overrides,
  };
}

/** jsdom does no layout, so the measured heights are stubbed: the panel is `panelHeight` px tall, its
 * content is `contentHeight` px, and each block sits at the given offsets. */
function stubLayout(options: {
  panelHeight: number;
  contentHeight: number;
  blocks?: Record<string, [number, number]>;
  /** Height of the content of the sheet header, whose box is `panelHeight` tall in this stub. */
  headerContentHeight?: number;
}) {
  const clientHeight = vi.spyOn(HTMLElement.prototype, "clientHeight", "get");
  const scrollHeight = vi.spyOn(HTMLElement.prototype, "scrollHeight", "get");
  const offsetTop = vi.spyOn(HTMLElement.prototype, "offsetTop", "get");
  const offsetHeight = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get");

  clientHeight.mockImplementation(() => options.panelHeight);
  scrollHeight.mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains("ficha-panel")) return options.contentHeight;
    return this.classList.contains("ficha-header") ? (options.headerContentHeight ?? 0) : 0;
  });
  offsetTop.mockImplementation(function (this: HTMLElement) {
    return options.blocks?.[this.dataset.block ?? ""]?.[0] ?? 0;
  });
  offsetHeight.mockImplementation(function (this: HTMLElement) {
    return options.blocks?.[this.dataset.block ?? ""]?.[1] ?? 0;
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("measureSheetFit", () => {
  it("da por bueno el contenido cuando el navegador no calcula alturas", () => {
    expect(measureSheetFit(content({ puntos: ["Pase"] })).fits).toBe(true);
  });

  it("indica que cabe cuando el contenido no supera la altura del panel", () => {
    stubLayout({ panelHeight: 600, contentHeight: 580 });
    expect(measureSheetFit(content({ puntos: ["Pase"] }))).toEqual({ fits: true, overflowPx: 0, overflowingBlocks: [] });
  });

  it("tolera un píxel de diferencia", () => {
    stubLayout({ panelHeight: 600, contentHeight: 601 });
    expect(measureSheetFit(content({ puntos: ["Pase"] })).fits).toBe(true);
  });

  it("indica cuánto sobra y qué bloques se salen cuando el contenido no cabe", () => {
    stubLayout({
      panelHeight: 600,
      contentHeight: 720,
      blocks: { "Qué se hace": [0, 300], Reglas: [300, 250], Montaje: [550, 170] },
    });

    const fit = measureSheetFit(content({ queSeHace: "a", reglas: ["b"], montaje: ["c"] }));

    expect(fit.fits).toBe(false);
    expect(fit.overflowPx).toBe(120);
    expect(fit.overflowingBlocks).toEqual(["Montaje"]);
  });

  it("incluye en la medida la línea del modelo de juego de la cabecera cuando la hoja la lleva", () => {
    stubLayout({ panelHeight: 64, contentHeight: 10, headerContentHeight: 80 });

    const fit = measureSheetFit(content({ modeloDeJuego: "1.1.20 Delantero" }));

    expect(fit).toEqual({ fits: false, overflowPx: 16, overflowingBlocks: ["Modelo de juego"] });
  });

  it("no mide la cabecera cuando la hoja no lleva línea del modelo de juego", () => {
    stubLayout({ panelHeight: 64, contentHeight: 10, headerContentHeight: 80 });

    expect(measureSheetFit(content()).fits).toBe(true);
  });

  it("mide la cabecera con los mismos estilos y el mismo marcado que se imprimen", () => {
    const append = vi.spyOn(document.body, "appendChild");
    measureSheetFit(content({ modeloDeJuego: "1.1.20 Delantero" }));
    const hosts = append.mock.calls.map((call) => (call[0] as HTMLElement).innerHTML);
    expect(hosts.some((html) => html.includes('class="ficha-header"') && html.includes("1.1.20 Delantero"))).toBe(true);
  });

  it("no deja rastro en el documento tras medir", () => {
    const before = document.body.children.length;
    measureSheetFit(content({ puntos: ["Pase"] }));
    expect(document.body.children.length).toBe(before);
  });

  it("mide el mismo panel que se imprime, con sus estilos", () => {
    const append = vi.spyOn(document.body, "appendChild");
    measureSheetFit(content({ reglas: ["Dos toques"] }));
    const host = append.mock.calls[0][0] as HTMLElement;
    expect(host.innerHTML).toContain('class="ficha-panel"');
    expect(host.innerHTML).toContain("<style>");
    expect(host.innerHTML).toContain("Dos toques");
  });
});

describe("legendFits", () => {
  it("cabe cuando el navegador no calcula alturas", () => {
    expect(legendFits('<div class="ficha-legend">Material</div>', 25)).toBe(true);
  });

  it("cabe cuando la leyenda es más baja que el espacio libre", () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("ficha-legend") ? 40 : 94;
    });
    expect(legendFits('<div class="ficha-legend">Material</div>', 25)).toBe(true);
  });

  it("no cabe cuando la leyenda es más alta que el espacio libre", () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("ficha-legend") ? 120 : 94;
    });
    expect(legendFits('<div class="ficha-legend">Material</div>', 25)).toBe(false);
  });
});

describe("findOverflowingSheets", () => {
  it("devuelve solo las fichas que no caben, con su bloque de sesión", () => {
    stubLayout({ panelHeight: 600, contentHeight: 700 });
    const overflowing = findOverflowingSheets([
      { exercise: exercise({ id: "a", puntos: ["largo"] }), blockName: "Principal" },
    ]);
    expect(overflowing).toHaveLength(1);
    expect(overflowing[0].exercise.id).toBe("a");
    expect(overflowing[0].blockName).toBe("Principal");
  });

  it("mide cada hoja con la línea del modelo de juego de su sesión", () => {
    stubLayout({ panelHeight: 64, contentHeight: 10, headerContentHeight: 80 });

    const overflowing = findOverflowingSheets([
      { exercise: exercise({ id: "a" }), modeloDeJuego: "1.1.20 Delantero" },
      { exercise: exercise({ id: "b" }) },
    ]);

    expect(overflowing.map((sheet) => sheet.exercise.id)).toEqual(["a"]);
  });

  it("no devuelve nada cuando todas caben", () => {
    stubLayout({ panelHeight: 600, contentHeight: 300 });
    expect(findOverflowingSheets([{ exercise: exercise() }])).toEqual([]);
  });
});

describe("describeOverflow", () => {
  it("nombra los bloques que se salen y cuánto sobra en centímetros", () => {
    const text = describeOverflow({ fits: false, overflowPx: 96, overflowingBlocks: ["Reglas", "Niveles"] });
    expect(text).toContain("«Reglas», «Niveles»");
    expect(text).toContain("2,5 cm");
  });

  it("explica cuánto sobra aunque no se sepa qué bloque", () => {
    expect(describeOverflow({ fits: false, overflowPx: 10, overflowingBlocks: [] })).toContain("0,5 cm");
  });
});
