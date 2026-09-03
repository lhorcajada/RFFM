import { describe, expect, it } from "vitest";
import { buildExercisePrintHtml, mediaUrl } from "../exercisePrint";
import type { Exercise } from "../../../types/training";

function buildExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "ex-1",
    name: "Rondo 4v2",
    tipo: "Situacional",
    objetivo: "Mejorar la posesión",
    modelRelations: [],
    nivelesColumnas: [],
    niveles: [],
    logistica: "15 min · 6 conos · 6 jugadores",
    descripcion: "Descripción del ejercicio",
    isAssociatedToGameModel: false,
    ...overrides,
  };
}

describe("buildExercisePrintHtml", () => {
  it("incluye el nombre, tipo y duración del ejercicio", () => {
    const html = buildExercisePrintHtml(buildExercise({ name: "Rondo 4v2", durationMinutes: 20 }));
    expect(html).toContain("Rondo 4v2");
    expect(html).toContain("Situacional");
    expect(html).toContain("20 min");
  });

  it("incluye el objetivo por rol solo cuando está presente", () => {
    const withRole = buildExercisePrintHtml(buildExercise({ objetivoPorRol: "Pivote: recibe de espaldas" }));
    expect(withRole).toContain("Pivote: recibe de espaldas");

    const withoutRole = buildExercisePrintHtml(buildExercise({ objetivoPorRol: null }));
    expect(withoutRole).not.toContain("Objetivo por rol");
  });

  it("incluye porteros y dibujo solo cuando están presentes", () => {
    const html = buildExercisePrintHtml(
      buildExercise({ porteros: "2 porteros en portería pequeña", dibujo: "Ver pizarra adjunta" }),
    );
    expect(html).toContain("2 porteros en portería pequeña");
    expect(html).toContain("Ver pizarra adjunta");

    const empty = buildExercisePrintHtml(buildExercise({ porteros: null, dibujo: null }));
    expect(empty).not.toContain("Porteros");
    expect(empty).not.toContain("Dibujo");
  });

  it("renderiza la tabla de niveles cuando hay columnas definidas", () => {
    const html = buildExercisePrintHtml(
      buildExercise({
        nivelesColumnas: ["Espacio", "Nº jugadores"],
        niveles: [
          { nivel: 1, valores: { Espacio: "Reducido", "Nº jugadores": "4v2" } },
          { nivel: 2, valores: { Espacio: "Amplio", "Nº jugadores": "5v3" } },
        ],
      }),
    );
    expect(html).toContain("<table");
    expect(html).toContain("Espacio");
    expect(html).toContain("Nº jugadores");
    expect(html).toContain("Reducido");
    expect(html).toContain("4v2");
    expect(html).toContain("Amplio");
    expect(html).toContain("5v3");
  });

  it("no renderiza tabla de niveles cuando no hay columnas", () => {
    const html = buildExercisePrintHtml(buildExercise({ nivelesColumnas: [], niveles: [] }));
    expect(html).not.toContain("<table");
  });

  it("incluye chips de relación con el modelo", () => {
    const html = buildExercisePrintHtml(
      buildExercise({
        isAssociatedToGameModel: true,
        modelRelations: [
          {
            id: "rel-1",
            subprincipioId: "sub-1",
            subprincipioNumero: "1.1",
            subprincipioTitulo: "Presión alta",
            isFoco: true,
            habilidadesImprescindibles: ["Pase"],
            items: [
              {
                id: "item-1",
                subSubPrincipioId: "ssp-1",
                subSubPrincipioNumero: "1.1.1",
                subSubPrincipioRol: "Central",
                isFoco: false,
              },
            ],
          },
        ],
      }),
    );
    expect(html).toContain("1.1");
    expect(html).toContain("Presión alta");
    expect(html).toContain("1.1.1");
    expect(html).toContain("Central");
    expect(html).toContain("Pase");
  });

  it("usa la imagen subida (urlImage) cuando está presente", () => {
    const html = buildExercisePrintHtml(buildExercise({ urlImage: "exercises/foo.png" }));
    expect(html).toContain("<img");
    expect(html).toContain(mediaUrl("exercises/foo.png"));
  });

  it("incrusta el marcado de la pizarra táctica cuando no hay imagen subida", () => {
    const html = buildExercisePrintHtml(
      buildExercise({ urlImage: null }),
      '<div class="board"><div class="pitch"><div class="chapa">9</div></div></div>',
    );
    expect(html).toContain('<div class="board">');
    expect(html).toContain('<div class="chapa">9</div>');
  });

  it("prioriza la imagen subida sobre la pizarra táctica si ambas existen", () => {
    const html = buildExercisePrintHtml(
      buildExercise({ urlImage: "exercises/foo.png" }),
      '<div class="board">pizarra</div>',
    );
    expect(html).toContain(mediaUrl("exercises/foo.png"));
    expect(html).not.toContain("pizarra");
  });

  it("no renderiza imagen ni pizarra cuando no hay urlImage ni dibujo de pizarra", () => {
    const html = buildExercisePrintHtml(buildExercise({ urlImage: null }));
    expect(html).not.toContain("<img");
    expect(html).not.toContain('<div class="board-drawing">');
  });

  it("escapa HTML en campos de texto libre", () => {
    const html = buildExercisePrintHtml(buildExercise({ descripcion: "<script>alert(1)</script>" }));
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
