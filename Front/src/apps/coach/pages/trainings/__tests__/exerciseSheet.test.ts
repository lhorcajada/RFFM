import { describe, expect, it } from "vitest";
import {
  SHEET_BODY_HEIGHT_MM,
  buildSheetHeadingHtml,
  buildSheetPanelHtml,
  buildSheetSubtitle,
  collectMaterialLegend,
  legendFreeHeightMm,
  pitchBoxMm,
  printableLevels,
  sheetContentFromExercise,
  sheetContentFromForm,
  type SheetContent,
} from "../exerciseSheet";
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

describe("buildSheetSubtitle", () => {
  it("une espacio, turno y nivel con un separador", () => {
    const subtitle = buildSheetSubtitle(
      content({
        espacio: "20x30 m",
        turnoMinutos: 4,
        nivelDibujo: 1,
        nivelesColumnas: ["Toques"],
        niveles: [{ nivel: 1, valores: { Toques: "libres" } }],
      }),
    );
    expect(subtitle).toBe("Espacio: 20x30 m · Turno: 4 min · Nivel 1");
  });

  it("omite el espacio y su separador cuando falta", () => {
    expect(buildSheetSubtitle(content({ turnoMinutos: 4 }))).toBe("Turno: 4 min");
  });

  it("trata un espacio con solo espacios en blanco como ausente", () => {
    expect(buildSheetSubtitle(content({ espacio: "   ", turnoMinutos: 4 }))).toBe("Turno: 4 min");
  });

  it("no menciona nivel cuando no hay filas de niveles con contenido", () => {
    const subtitle = buildSheetSubtitle(
      content({
        espacio: "20x30 m",
        nivelDibujo: 1,
        nivelesColumnas: ["Toques"],
        niveles: [{ nivel: 1, valores: { Toques: "  " } }],
      }),
    );
    expect(subtitle).toBe("Espacio: 20x30 m");
  });
});

describe("buildSheetPanelHtml", () => {
  it("imprime el panel vacío cuando no hay contenido", () => {
    expect(buildSheetPanelHtml(content())).toBe('<div class="ficha-panel"></div>');
  });

  it("imprime los bloques en el orden Qué se hace, Reglas, Puntos, Rotaciones, Montaje y Niveles", () => {
    const html = buildSheetPanelHtml(
      content({
        queSeHace: "Se juega 4v2",
        reglas: ["Dos toques"],
        puntos: ["Gol = 1 punto"],
        rotaciones: ["Rota cada 3 minutos"],
        montaje: ["Cuadro de 20x30"],
        nivelesColumnas: ["Toques"],
        niveles: [{ nivel: 1, valores: { Toques: "libres" } }],
      }),
    );
    const order = ["Qué se hace", "Reglas", "Puntos", "Rotaciones", "Montaje", "Niveles"].map((title) =>
      html.indexOf(`data-block="${title}"`),
    );
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("imprime las listas Reglas, Puntos, Rotaciones y Montaje como listas simples", () => {
    const html = buildSheetPanelHtml(
      content({ reglas: ["Dos toques"], puntos: ["Gol"], rotaciones: ["Cada 3 min"], montaje: ["8 conos"] }),
    );
    expect(html).toContain('<ul class="ficha-list"><li>Dos toques</li></ul>');
    expect(html).toContain('<ul class="ficha-list"><li>Gol</li></ul>');
    expect(html).toContain('<ul class="ficha-list"><li>Cada 3 min</li></ul>');
    expect(html).toContain('<ul class="ficha-list"><li>8 conos</li></ul>');
  });

  it("conserva los saltos de línea de Qué se hace como un párrafo por línea", () => {
    const html = buildSheetPanelHtml(content({ queSeHace: "Primera parte\n\n  Segunda parte  \n" }));
    expect(html).toContain('data-block="Qué se hace"');
    expect(html).toContain('<p class="ficha-text">Primera parte</p><p class="ficha-text">Segunda parte</p>');
  });

  it("omite un bloque sin contenido y el bloque entero si solo tiene líneas en blanco", () => {
    const html = buildSheetPanelHtml(
      content({ queSeHace: "  \n ", reglas: ["Una", " "], puntos: ["  ", ""], rotaciones: [], montaje: [""] }),
    );
    expect(html).not.toContain('data-block="Qué se hace"');
    expect(html).not.toContain('data-block="Puntos"');
    expect(html).not.toContain('data-block="Rotaciones"');
    expect(html).not.toContain('data-block="Montaje"');
    expect(html.match(/<li>/g)).toHaveLength(1);
  });

  it("no imprime bloque de jugadores, de objetivos por equipo, de secuencia ni de qué se ve", () => {
    const html = buildSheetPanelHtml(
      content({ queSeHace: "Texto", reglas: ["Regla"], puntos: ["Punto"], rotaciones: ["Rotación"], montaje: ["Montaje"] }),
    );
    for (const title of ["Jugadores", "Objetivos", "Secuencia", "Qué se ve sin decir nada"]) {
      expect(html).not.toContain(`data-block="${title}"`);
    }
  });

  it("marca la fila del nivel que muestra el dibujo y no usa tablas", () => {
    const html = buildSheetPanelHtml(
      content({
        nivelDibujo: 2,
        nivelesColumnas: ["Toques"],
        niveles: [
          { nivel: 1, valores: { Toques: "libres" } },
          { nivel: 2, valores: { Toques: "2 toques" } },
        ],
      }),
    );
    expect(html.match(/ficha-level--marked/g)).toHaveLength(1);
    expect(html).toContain("ficha-level ficha-level--marked");
    expect(html).not.toContain("<table");
  });

  it("no imprime los niveles cuando ninguna fila tiene contenido", () => {
    const html = buildSheetPanelHtml(
      content({ nivelesColumnas: ["Toques"], niveles: [{ nivel: 1, valores: {} }, { nivel: 2, valores: {} }] }),
    );
    expect(html).not.toContain('data-block="Niveles"');
  });

  it("no imprime en el panel ninguna línea del modelo de juego, ni siquiera cuando la hoja la lleva en la cabecera", () => {
    expect(buildSheetPanelHtml(content({ modeloDeJuego: "1.1.20 Delantero" }))).not.toContain("Modelo de juego");
  });

  it("escapa el HTML de los textos del panel", () => {
    const html = buildSheetPanelHtml(
      content({ reglas: ["<img src=x onerror=alert(1)>"], queSeHace: "<script>alert(1)</script>" }),
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;img");
  });
});

describe("printableLevels", () => {
  it("devuelve las filas con contenido ordenadas por nivel", () => {
    const rows = printableLevels(
      content({
        nivelesColumnas: ["A"],
        niveles: [
          { nivel: 2, valores: { A: "dos" } },
          { nivel: 1, valores: {} },
          { nivel: 3, valores: { A: "tres" } },
        ],
      }),
    );
    expect(rows.map((row) => row.nivel)).toEqual([2, 3]);
  });
});

describe("pitchBoxMm", () => {
  it("usa la proporción 105 x 68 con el campo completo, ajustado al ancho de la columna", () => {
    const box = pitchBoxMm("full");
    expect(box.width / box.height).toBeCloseTo(105 / 68, 3);
  });

  it("usa la proporción 52,5 x 68 con medio campo, izquierdo o derecho", () => {
    const right = pitchBoxMm("right");
    expect(right.width / right.height).toBeCloseTo(52.5 / 68, 3);
    expect(pitchBoxMm("left")).toEqual(right);
  });

  it("deja más espacio libre bajo el dibujo con el campo completo que con medio campo", () => {
    expect(legendFreeHeightMm("full")).toBeGreaterThan(legendFreeHeightMm("right"));
    expect(legendFreeHeightMm("right")).toBeGreaterThan(0);
    expect(legendFreeHeightMm("full")).toBeLessThan(SHEET_BODY_HEIGHT_MM);
  });
});

describe("collectMaterialLegend", () => {
  it("cuenta el material colocado por tipo", () => {
    const boardStateJson = JSON.stringify({
      placedMaterials: [
        { id: "1", kind: "conos" },
        { id: "2", kind: "conos" },
        { id: "3", kind: "picas" },
      ],
    });
    expect(collectMaterialLegend({ boardStateJson })).toEqual([
      { label: "Conos", count: 2 },
      { label: "Picas", count: 1 },
    ]);
  });

  it("devuelve una lista vacía sin pizarra o sin material", () => {
    expect(collectMaterialLegend({ boardStateJson: null })).toEqual([]);
    expect(collectMaterialLegend({ boardStateJson: JSON.stringify({ placedChapas: {} }) })).toEqual([]);
  });
});

describe("buildSheetHeadingHtml", () => {
  it("imprime una línea compacta con los objetivos del modelo de juego bajo el título cuando la hoja la lleva", () => {
    const html = buildSheetHeadingHtml("Rondo", content({ modeloDeJuego: "1.1.20 Delantero · 1.1.21 Media punta" }));
    expect(html).toContain('<h1 class="ficha-title">Rondo</h1>');
    expect(html).toContain('<div class="ficha-modelo"><strong>Modelo de juego:</strong> 1.1.20 Delantero · 1.1.21 Media punta</div>');
  });

  it("no imprime la línea cuando la hoja no tiene objetivos del modelo de juego", () => {
    expect(buildSheetHeadingHtml("Rondo", content())).not.toContain("Modelo de juego");
    expect(buildSheetHeadingHtml("Rondo", content({ modeloDeJuego: "   " }))).not.toContain("Modelo de juego");
  });

  it("escapa el HTML de la línea del modelo de juego", () => {
    const html = buildSheetHeadingHtml("Rondo", content({ modeloDeJuego: "<b>1.1</b>" }));
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;1.1&lt;/b&gt;");
  });
});

describe("sheetContentFrom*", () => {
  const exercise = {
    id: "ex",
    name: "Ej",
    tipo: "Global",
    objetivo: "",
    nivelesColumnas: [],
    niveles: [],
    logistica: "",
    descripcion: "",
  } as Exercise;

  it("una ficha de ejercicio no lleva línea del modelo de juego salvo que la sesión la aporte", () => {
    expect(sheetContentFromExercise(exercise).modeloDeJuego).toBe("");
    expect(sheetContentFromExercise(exercise, "1.1.20 Delantero").modeloDeJuego).toBe("1.1.20 Delantero");
  });

  it("deja los campos ausentes del ejercicio como valores vacíos", () => {
    const result = sheetContentFromExercise(exercise);
    expect(result.espacio).toBeNull();
    expect(result.queSeHace).toBe("");
    expect(result.puntos).toEqual([]);
    expect(result.rotaciones).toEqual([]);
    expect(result.montaje).toEqual([]);
  });

  it("toma la descripción del ejercicio como Qué se hace y sus listas nuevas", () => {
    const result = sheetContentFromExercise({
      ...exercise,
      descripcion: "Parte 1\nParte 2",
      puntos: ["Gol"],
      rotaciones: ["Cada 3 min"],
      montaje: ["8 conos"],
    });
    expect(result.queSeHace).toBe("Parte 1\nParte 2");
    expect(result.puntos).toEqual(["Gol"]);
    expect(result.rotaciones).toEqual(["Cada 3 min"]);
    expect(result.montaje).toEqual(["8 conos"]);
  });

  it("toma del formulario la descripción como Qué se hace y ninguna línea del modelo de juego", () => {
    const result = sheetContentFromForm({ descripcion: "Se juega 4v2", puntos: ["Gol"] });
    expect(result.modeloDeJuego).toBe("");
    expect(result.queSeHace).toBe("Se juega 4v2");
    expect(result.puntos).toEqual(["Gol"]);
  });
});
