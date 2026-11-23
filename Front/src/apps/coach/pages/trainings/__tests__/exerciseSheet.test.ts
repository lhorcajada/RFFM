import { describe, expect, it } from "vitest";
import {
  SHEET_BODY_HEIGHT_MM,
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
    jugadores: [],
    secuencia: [],
    reglas: [],
    queSeVe: [],
    nivelesColumnas: [],
    niveles: [],
    modeloDeJuego: [],
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

  it("imprime cada equipo con su color, nombre, número y roles", () => {
    const html = buildSheetPanelHtml(
      content({
        jugadores: [{ color: "yellow", nombre: "Amarillos", cantidad: 5, roles: "1 pivote", objetivos: [] }],
      }),
    );
    expect(html).toContain("ficha-swatch--yellow");
    expect(html).toContain("<strong>Amarillos</strong> · 5 jug.");
    expect(html).toContain("1 pivote");
  });

  it("construye el objetivo de cada equipo con sus líneas, sin bloque aparte", () => {
    const html = buildSheetPanelHtml(
      content({
        jugadores: [
          { color: "blue", nombre: "Azules", cantidad: 4, roles: null, objetivos: ["Mantener la posesión", ""] },
          { color: "gray", nombre: "Grises", cantidad: 2, roles: null, objetivos: ["Robar"] },
        ],
      }),
    );
    expect(html).toContain('data-block="Objetivos"');
    expect(html).toContain("Mantener la posesión");
    expect(html).toContain("Robar");
    expect(html.match(/<li>/g)).toHaveLength(2);
  });

  it("no imprime el bloque de objetivos cuando ningún equipo tiene líneas", () => {
    const html = buildSheetPanelHtml(
      content({ jugadores: [{ color: "blue", nombre: "Azules", cantidad: 4, roles: null, objetivos: [] }] }),
    );
    expect(html).toContain('data-block="Jugadores"');
    expect(html).not.toContain('data-block="Objetivos"');
  });

  it("numera la secuencia y deja reglas y «qué se ve» como listas simples", () => {
    const html = buildSheetPanelHtml(
      content({ secuencia: ["Pase", "Desmarque"], reglas: ["Dos toques"], queSeVe: ["Ritmo alto"] }),
    );
    expect(html).toContain('<ol class="ficha-list"><li>Pase</li><li>Desmarque</li></ol>');
    expect(html).toContain('<ul class="ficha-list"><li>Dos toques</li></ul>');
    expect(html).toContain("Qué se ve sin decir nada");
  });

  it("omite las líneas en blanco de una lista y la lista entera si solo tiene líneas en blanco", () => {
    const html = buildSheetPanelHtml(content({ secuencia: ["  ", ""], reglas: ["Una", " "] }));
    expect(html).not.toContain('data-block="Secuencia"');
    expect(html.match(/<li>/g)).toHaveLength(1);
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

  it("imprime una línea compacta con las relaciones del modelo de juego solo cuando las hay", () => {
    expect(buildSheetPanelHtml(content())).not.toContain("Modelo de juego");
    const html = buildSheetPanelHtml(content({ modeloDeJuego: ["1.1 · Presión alta", "1.1.1 · Central"] }));
    expect(html).toContain("<strong>Modelo de juego:</strong> 1.1 · Presión alta · 1.1.1 · Central");
  });

  it("escapa el HTML de los textos del panel", () => {
    const html = buildSheetPanelHtml(content({ reglas: ["<img src=x onerror=alert(1)>"] }));
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("trata un equipo migrado, sin nombre ni color, solo como objetivo", () => {
    const html = buildSheetPanelHtml(
      content({ jugadores: [{ color: null, nombre: "", cantidad: null, roles: null, objetivos: ["Por rol"] }] }),
    );
    expect(html).not.toContain('data-block="Jugadores"');
    expect(html).toContain("Por rol");
    expect(html).not.toContain("ficha-team-heading");
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
    isAssociatedToGameModel: true,
    modelRelations: [
      {
        id: "r1",
        subprincipioId: "s1",
        subprincipioNumero: "1.1",
        subprincipioTitulo: "Presión",
        isFoco: true,
        habilidadesImprescindibles: [],
        items: [
          { id: "i1", subSubPrincipioId: "ss1", subSubPrincipioNumero: "1.1.1", subSubPrincipioRol: "Central", isFoco: false },
        ],
      },
    ],
  } as Exercise;

  it("toma del ejercicio una etiqueta por subprincipio y por rol", () => {
    expect(sheetContentFromExercise(exercise).modeloDeJuego).toEqual(["1.1 · Presión", "1.1.1 · Central"]);
  });

  it("deja los campos ausentes del ejercicio como valores vacíos", () => {
    const result = sheetContentFromExercise(exercise);
    expect(result.espacio).toBeNull();
    expect(result.secuencia).toEqual([]);
    expect(result.jugadores).toEqual([]);
  });

  it("toma del formulario una etiqueta genérica por cada relación con el modelo", () => {
    const result = sheetContentFromForm({ modelRelations: [{}, {}], secuencia: ["Pase"] });
    expect(result.modeloDeJuego).toHaveLength(2);
    expect(result.secuencia).toEqual(["Pase"]);
  });
});
