import { describe, expect, it } from "vitest";
import { buildExercisePrintHtml, buildExerciseSheetHtml, mediaUrl } from "../exercisePrint";
import type { Exercise } from "../../../types/training";
import boardStyles from "../../../components/TacticalBoardSnapshotPreview.module.css";

function buildExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "ex-1",
    name: "Rondo 4v2",
    tipo: "Situacional",
    objetivo: "Mejorar la posesión",
    nivelesColumnas: [],
    niveles: [],
    logistica: "",
    descripcion: "",
    ...overrides,
  };
}

const rightHalfBoard = JSON.stringify({ placedChapas: { p1: { x: 30, y: 30 }, p2: { x: 70, y: 60 } } });
const fullPitchBoard = JSON.stringify({ placedChapas: { p1: { x: -30, y: 30 }, p2: { x: 30, y: 60 } } });

describe("buildExercisePrintHtml", () => {
  it("incluye el nombre, tipo y duración del ejercicio", () => {
    const html = buildExercisePrintHtml(buildExercise({ name: "Rondo 4v2", durationMinutes: 20 }));
    expect(html).toContain("Rondo 4v2");
    expect(html).toContain("Situacional");
    expect(html).toContain("20 min");
  });

  it("incluye el subtipo traducido cuando el ejercicio lo tiene", () => {
    const html = buildExercisePrintHtml(buildExercise({ subtipo: "PartidoCondicionado" }));
    expect(html).toContain("Partido condicionado");
  });

  it("imprime en una hoja A4 apaisada", () => {
    const html = buildExercisePrintHtml(buildExercise());
    expect(html).toContain("@page { size: A4 landscape");
    expect(html.match(/<section class="ficha">/g)).toHaveLength(1);
  });

  it("usa la imagen subida (urlImage) como dibujo cuando está presente", () => {
    const html = buildExercisePrintHtml(buildExercise({ urlImage: "exercises/foo.png" }));
    expect(html).toContain("<img");
    expect(html).toContain(mediaUrl("exercises/foo.png"));
  });

  it("prioriza la imagen subida sobre la pizarra táctica si ambas existen", () => {
    const html = buildExercisePrintHtml(
      buildExercise({ urlImage: "exercises/foo.png", boardStateJson: rightHalfBoard }),
    );
    expect(html).toContain(mediaUrl("exercises/foo.png"));
    expect(html).not.toContain("Vista previa de la pizarra");
  });

  it("pinta la pizarra táctica cuando no hay imagen subida", () => {
    const html = buildExercisePrintHtml(buildExercise({ boardStateJson: rightHalfBoard }));
    expect(html).toContain("Vista previa de la pizarra");
    expect(html).not.toContain("<img");
  });

  it("recorta el dibujo al medio campo cuando todos los objetos están en una mitad", () => {
    const html = buildExerciseSheetHtml(buildExercise({ boardStateJson: rightHalfBoard }));
    expect(html).toContain("ficha-drawing--half");
    expect(html).toContain('data-viewport="right"');
  });

  it("imprime el campo completo cuando el dibujo usa las dos mitades", () => {
    const html = buildExerciseSheetHtml(buildExercise({ boardStateJson: fullPitchBoard }));
    expect(html).toContain("ficha-drawing--full");
    expect(html).not.toContain("data-viewport=");
  });

  it("imprime el campo de la pizarra con fondo blanco y líneas negras", () => {
    const html = buildExercisePrintHtml(buildExercise({ boardStateJson: rightHalfBoard }));
    expect(html).toContain(`.${boardStyles.pitch}, .${boardStyles.mirrorHalf} { background: #fff`);
    expect(html).toContain(`.${boardStyles.midLine}, .${boardStyles.goalLine} { background: #000`);
  });

  it("resuelve dorsal y alias de los jugadores con el roster recibido", () => {
    const boardStateJson = JSON.stringify({ placedChapas: { "player-1": { x: 10, y: 10 } } });
    const playersById = new Map([["player-1", { alias: "Ani", dorsal: 9 }]]);
    const html = buildExercisePrintHtml(buildExercise({ boardStateJson }), { playersById });
    expect(html).toContain("Ani");
    expect(html).toContain(">9<");
  });

  it("muestra «Sin dibujo» y sigue ocupando una página cuando no hay imagen ni dibujo", () => {
    const html = buildExercisePrintHtml(buildExercise({ urlImage: null, boardStateJson: null }));
    expect(html).toContain("Sin dibujo");
    expect(html).not.toContain("<img");
    expect(html.match(/<section class="ficha">/g)).toHaveLength(1);
  });

  it("trata una pizarra sin objetos como un ejercicio sin dibujo", () => {
    const html = buildExercisePrintHtml(buildExercise({ boardStateJson: JSON.stringify({ placedChapas: {} }) }));
    expect(html).toContain("Sin dibujo");
  });

  it("escapa HTML en los campos de texto libre", () => {
    const html = buildExercisePrintHtml(
      buildExercise({ name: "<b>Nombre</b>", secuencia: ["<script>alert(1)</script>"] }),
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<b>Nombre</b>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("no incluye ninguna tabla", () => {
    const html = buildExercisePrintHtml(
      buildExercise({
        nivelesColumnas: ["Espacio"],
        niveles: [{ nivel: 1, valores: { Espacio: "8x8" } }],
      }),
    );
    expect(html).not.toContain("<table");
    expect(html).not.toContain("<td");
  });

  it("la hoja de un ejercicio suelto no lleva línea del modelo de juego", () => {
    expect(buildExercisePrintHtml(buildExercise())).not.toContain('<div class="ficha-modelo">');
  });

  it("el pie de la hoja de un ejercicio suelto queda vacío", () => {
    const html = buildExercisePrintHtml(buildExercise());
    expect(html).toContain('<footer class="ficha-footer"></footer>');
  });
});

describe("buildExerciseSheetHtml — subtítulo y bloques", () => {
  it("compone el subtítulo con espacio, turno y nivel del dibujo", () => {
    const html = buildExerciseSheetHtml(
      buildExercise({
        espacio: "20x30 m",
        turnoMinutos: 3,
        nivelDibujo: 2,
        nivelesColumnas: ["Toques"],
        niveles: [
          { nivel: 1, valores: { Toques: "libres" } },
          { nivel: 2, valores: { Toques: "2 toques" } },
        ],
      }),
    );
    expect(html).toContain("Espacio: 20x30 m · Turno: 3 min · Nivel 2");
  });

  it("omite del subtítulo el turno cuando falta, junto a su separador", () => {
    const html = buildExerciseSheetHtml(buildExercise({ espacio: "20x30 m", turnoMinutos: null }));
    expect(html).toContain("Espacio: 20x30 m<");
    expect(html).not.toContain("Turno");
    expect(html).not.toContain("·</div>");
  });

  it("no imprime subtítulo cuando no hay espacio, turno ni nivel", () => {
    const html = buildExerciseSheetHtml(buildExercise());
    expect(html).not.toContain("ficha-subtitle");
  });

  it("no imprime un bloque sin contenido ni su título", () => {
    const html = buildExerciseSheetHtml(buildExercise({ secuencia: ["Pase"], reglas: [], queSeVe: [] }));
    expect(html).toContain("Secuencia");
    expect(html).not.toContain("Reglas");
    expect(html).not.toContain("Qué se ve sin decir nada");
    expect(html).not.toContain("Jugadores");
    expect(html).not.toContain("Objetivos");
    expect(html).not.toContain("Niveles");
  });

  it("imprime el pie con la sesión y el bloque cuando se recibe", () => {
    const html = buildExerciseSheetHtml(buildExercise(), { footer: "Sesión: Presión · Bloque: Activación" });
    expect(html).toContain("Sesión: Presión · Bloque: Activación");
  });

  it("imprime la leyenda de material cuando el ejercicio tiene material colocado", () => {
    const boardStateJson = JSON.stringify({
      placedChapas: { p1: { x: 30, y: 30 } },
      placedMaterials: [
        { id: "m1", kind: "conos", x: 20, y: 20, rotation: 0 },
        { id: "m2", kind: "conos", x: 25, y: 20, rotation: 0 },
        { id: "m3", kind: "balones", x: 40, y: 40, rotation: 0 },
      ],
    });
    const html = buildExerciseSheetHtml(buildExercise({ boardStateJson }));
    expect(html).toContain("Material:");
    expect(html).toContain("Balones × 1");
    expect(html).toContain("Conos × 2");
  });

  it("omite la leyenda cuando no hay material colocado", () => {
    const html = buildExerciseSheetHtml(buildExercise({ boardStateJson: rightHalfBoard }));
    expect(html).not.toContain("ficha-legend");
  });
});
