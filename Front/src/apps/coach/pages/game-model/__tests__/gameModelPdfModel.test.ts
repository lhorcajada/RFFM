import { describe, expect, it } from "vitest";
import { buildGameModelPdfBlocks, gameModelPdfFileName } from "../gameModelPdfModel";
import type { GameModel, SubSubPrincipio } from "../../../types/gameModel";

const ssp = (over: Partial<SubSubPrincipio> = {}): SubSubPrincipio => ({
  id: 1,
  numero: "1.1.1",
  rol: "Portero",
  texto: "Ofrece línea de pase.",
  habilidades: [
    { id: 1, nombre: "Pase", descripcion: "Pase corto al pie", entrenable: "Sí" },
    { id: 2, nombre: "Colocación", descripcion: "", entrenable: "", referenciaAKey: "1.2.3" },
  ],
  notas: [{ id: 1, tipo: "riesgo-aceptado", texto: "Se asume perder el balón." }],
  ...over,
});

const model = (over: Partial<GameModel> = {}): GameModel => ({
  id: "m1",
  teamId: "t1",
  name: "Modelo Cadete B",
  season: "2026/2027",
  principles: [
    {
      id: 2,
      gameMomentId: 2,
      gameMomentName: "Defensa organizada",
      numero: 1,
      titulo: "Bloque medio",
      texto: "Defendemos juntos.",
      subprincipios: [],
      notas: [],
    },
    {
      id: 1,
      gameMomentId: 1,
      gameMomentName: "Ataque organizado",
      numero: 1,
      titulo: "Iniciar con el portero",
      texto: "Salimos jugando.",
      notas: [{ id: 9, tipo: "nota", texto: "Revisar en invierno." }],
      subprincipios: [
        {
          id: 3,
          numero: "1.2",
          titulo: "Segundo",
          texto: "",
          zonas: [],
          subSubPrincipios: [],
          notas: [],
        },
        {
          id: 4,
          numero: "1.1",
          titulo: "Primero",
          texto: "Texto del primero.",
          zonas: [
            {
              id: 5,
              zoneKeys: ["iniciacion"],
              texto: "En la zona de iniciación.",
              subSubPrincipios: [ssp()],
              notas: [],
            },
          ],
          subSubPrincipios: [],
          notas: [],
        },
      ],
    },
  ],
  setPieceRules: [{ id: 1, subtype: "corners-ofensivos", texto: "Dos al primer palo." }],
  openIssues: [{ id: 1, topic: "Salida con presión", description: "Definir la señal.", status: "open" }],
  ...over,
});

describe("buildGameModelPdfBlocks", () => {
  const blocks = buildGameModelPdfBlocks(model(), "Cadete B");

  it("abre con el título del modelo y el equipo con la temporada", () => {
    expect(blocks[0]).toEqual({ kind: "title", text: "Modelo Cadete B" });
    expect(blocks[1]).toEqual({ kind: "subtitle", text: "Cadete B · Temporada 2026/2027" });
  });

  it("ordena las fases por su id y los subprincipios por su numeración", () => {
    const headings = blocks.filter((b) => b.kind === "phase" || b.kind === "subprinciple").map((b) => b.text);

    expect(headings).toEqual([
      "Ataque organizado",
      "1.1 — Primero",
      "1.2 — Segundo",
      "Defensa organizada",
      "Balón parado",
      "Pendientes abiertos",
    ]);
  });

  it("escribe cada principio con su número y su texto", () => {
    const i = blocks.findIndex((b) => b.kind === "principle" && b.text === "1. Iniciar con el portero");

    expect(i).toBeGreaterThan(-1);
    expect(blocks[i + 1]).toEqual({ kind: "paragraph", text: "Salimos jugando." });
  });

  it("incluye la zona, el sub-subprincipio con su rol, las habilidades y las notas", () => {
    const texts = blocks.map((b) => `${b.kind}|${b.text}`);

    expect(texts).toContain("zone|Zona de Iniciación");
    expect(texts).toContain("subsubprinciple|1.1.1 — Portero");
    expect(texts).toContain("paragraph|Ofrece línea de pase.");
    expect(texts).toContain("bullet|Pase: Pase corto al pie (Entrenable: Sí)");
    expect(texts).toContain("bullet|Colocación (misma que 1.2.3)");
    expect(texts).toContain("note|Riesgo aceptado: Se asume perder el balón.");
    expect(texts).toContain("note|Nota: Revisar en invierno.");
  });

  it("añade el balón parado con el nombre legible de cada tipo", () => {
    const texts = blocks.map((b) => `${b.kind}|${b.text}`);

    expect(texts).toContain("phase|Balón parado");
    expect(texts).toContain("setpiece|Córners ofensivos");
    expect(texts).toContain("paragraph|Dos al primer palo.");
  });

  it("añade los pendientes indicando si siguen abiertos", () => {
    const texts = blocks.map((b) => `${b.kind}|${b.text}`);

    expect(texts).toContain("phase|Pendientes abiertos");
    expect(texts).toContain("bullet|Salida con presión (pendiente): Definir la señal.");
  });

  it("avisa cuando el modelo todavía no tiene contenido", () => {
    const empty = buildGameModelPdfBlocks(model({ principles: [], setPieceRules: [], openIssues: [] }));

    expect(empty.at(-1)).toEqual({ kind: "paragraph", text: "Este modelo de juego todavía no tiene contenido." });
  });

  it("sin nombre de equipo, el subtítulo solo lleva la temporada", () => {
    const [, subtitle] = buildGameModelPdfBlocks(model());

    expect(subtitle.text).toBe("Temporada 2026/2027");
  });
});

describe("gameModelPdfFileName", () => {
  it("nombra el archivo con el modelo y la temporada sin barras", () => {
    expect(gameModelPdfFileName(model())).toBe("Modelo Cadete B - 2026-2027.pdf");
  });
});
