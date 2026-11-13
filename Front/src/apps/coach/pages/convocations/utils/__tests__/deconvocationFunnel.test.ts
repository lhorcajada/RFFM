import { describe, expect, it } from "vitest";
import {
  attendanceBucket,
  classifyRivalDifficulty,
  compareFairness,
  describeCriterion,
  formatCriterionValues,
  protectionOf,
  type FairnessMetrics,
} from "../deconvocationFunnel";

function metrics(partial: Partial<FairnessMetrics> = {}): FairnessMetrics {
  return { consecutive: 3, surplus: 2, technicalTotal: 1, attendanceBucket: 8, rating: 6, ...partial };
}

describe("protectionOf", () => {
  const base = { technicalAgo: null, injuryAgo: null, calledCount: 10, minRequiredCalls: 6 };

  it("protege a quien fue desconvocado por decisión técnica dentro de la ventana", () => {
    const protection = protectionOf({ ...base, technicalAgo: 3 });

    expect(protection).toEqual({ kind: "technicalWindow", reason: "Protegido: desconvocado hace 3 jornadas" });
  });

  it("incluye el límite de la ventana de 8 jornadas", () => {
    expect(protectionOf({ ...base, technicalAgo: 8 })?.kind).toBe("technicalWindow");
  });

  it("no protege cuando la desconvocatoria técnica quedó fuera de la ventana", () => {
    expect(protectionOf({ ...base, technicalAgo: 9 })).toBeNull();
  });

  it("usa la ventana técnica configurada", () => {
    expect(protectionOf({ ...base, technicalAgo: 6 }, { technical: 4, injuryRest: 1, otherCause: 4 })).toBeNull();
  });

  it("protege 4 jornadas a quien fue desconvocado por otro motivo y dice cuál", () => {
    expect(protectionOf({ ...base, otherAgo: 4, otherReason: "Problema familiar" })).toEqual({
      kind: "otherCause",
      reason: "Protegido: desconvocado hace 4 jornadas por problema familiar",
    });
  });

  it("no protege una desconvocatoria por otro motivo de hace 5 jornadas", () => {
    expect(protectionOf({ ...base, otherAgo: 5, otherReason: "Problema familiar" })).toBeNull();
  });

  it("sin motivo conocido no lo inventa", () => {
    expect(protectionOf({ ...base, otherAgo: 1, otherReason: null })?.reason).toBe("Protegido: desconvocado hace 1 jornada por otro motivo");
  });

  it("si hay varias causas muestra la más reciente", () => {
    const protection = protectionOf({ ...base, technicalAgo: 5, otherAgo: 1, otherReason: "Problema familiar" });

    expect(protection).toEqual({ kind: "otherCause", reason: "Protegido: desconvocado hace 1 jornada por problema familiar" });
  });

  it("si la causa más reciente ya no protege, vale la otra", () => {
    const protection = protectionOf({ ...base, technicalAgo: 6, otherAgo: 5, otherReason: "Estudios" });

    expect(protection?.kind).toBe("technicalWindow");
  });

  it("protege a quien no vino la jornada anterior por lesión", () => {
    expect(protectionOf({ ...base, injuryAgo: 1 })).toEqual({
      kind: "injuryRest",
      reason: "Protegido: no vino la jornada anterior por lesión",
    });
  });

  it("no protege una lesión de hace dos jornadas con ventana de una", () => {
    expect(protectionOf({ ...base, injuryAgo: 2 })).toBeNull();
  });

  it("protege a quien está por debajo del mínimo de convocatorias", () => {
    expect(protectionOf({ ...base, calledCount: 5, minRequiredCalls: 6 })).toEqual({
      kind: "minCalls",
      reason: "Protegido: le falta 1 convocatoria para llegar al mínimo exigido (6)",
    });
  });

  it("no protege a quien ya alcanza el mínimo de convocatorias", () => {
    expect(protectionOf({ ...base, calledCount: 6, minRequiredCalls: 6 })).toBeNull();
  });

  it("muestra solo el primer motivo cuando hay varios", () => {
    const protection = protectionOf({ ...base, technicalAgo: 1, injuryAgo: 1, calledCount: 1 });

    expect(protection?.kind).toBe("technicalWindow");
  });
});

describe("compareFairness", () => {
  it("sale primero quien lleva más jornadas seguidas convocado", () => {
    const result = compareFairness(metrics({ consecutive: 5 }), metrics({ consecutive: 4, surplus: 9 }), "medium");

    expect(result.order).toBeLessThan(0);
    expect(result.criterion).toBe("consecutive");
  });

  it("con empate decide el excedente de convocatorias", () => {
    const result = compareFairness(metrics({ surplus: 1 }), metrics({ surplus: 4 }), "medium");

    expect(result.order).toBeGreaterThan(0);
    expect(result.criterion).toBe("surplus");
  });

  it("después decide tener menos desconvocatorias técnicas", () => {
    const result = compareFairness(metrics({ technicalTotal: 0 }), metrics({ technicalTotal: 2 }), "medium");

    expect(result.order).toBeLessThan(0);
    expect(result.criterion).toBe("technicalTotal");
  });

  it("después decide la menor asistencia", () => {
    const result = compareFairness(metrics({ attendanceBucket: 6 }), metrics({ attendanceBucket: 9 }), "medium");

    expect(result.order).toBeLessThan(0);
    expect(result.criterion).toBe("attendance");
  });

  it("ante rival difícil el menor nivel decide antes que las desconvocatorias técnicas", () => {
    const result = compareFairness(metrics({ rating: 5, technicalTotal: 3 }), metrics({ rating: 7, technicalTotal: 0 }), "hard");

    expect(result.order).toBeLessThan(0);
    expect(result.criterion).toBe("rating");
  });

  it("ante rival fácil o medio el nivel decide el último, tras la asistencia", () => {
    const hardFirst = metrics({ rating: 5, technicalTotal: 3 });
    const other = metrics({ rating: 7, technicalTotal: 0 });

    expect(compareFairness(hardFirst, other, "medium").criterion).toBe("technicalTotal");
    expect(compareFairness(metrics({ rating: 5 }), metrics({ rating: 7 }), "easy")).toEqual({ order: -2, criterion: "rating" });
  });

  it("sale antes el jugador de menor nivel cuando todo lo demás empata", () => {
    expect(compareFairness(metrics({ rating: 9 }), metrics({ rating: 4 }), "medium").order).toBeGreaterThan(0);
  });

  it("empata solo si todos los criterios, nivel incluido, coinciden", () => {
    expect(compareFairness(metrics(), metrics(), "medium")).toEqual({ order: 0, criterion: null });
  });
});

describe("attendanceBucket", () => {
  it("agrupa la asistencia en tramos del 10%", () => {
    expect(attendanceBucket(0.84)).toBe(8);
    expect(attendanceBucket(0.89)).toBe(8);
    expect(attendanceBucket(1)).toBe(10);
  });

  it("sin entrenos posibles cuenta como asistencia completa", () => {
    expect(attendanceBucket(null)).toBe(10);
  });
});

describe("classifyRivalDifficulty", () => {
  it("es difícil por debajo del umbral de victoria", () => {
    expect(classifyRivalDifficulty(0.32)).toBe("hard");
  });

  it("es fácil por encima del umbral superior", () => {
    expect(classifyRivalDifficulty(0.7)).toBe("easy");
  });

  it("es medio entre los umbrales", () => {
    expect(classifyRivalDifficulty(0.5)).toBe("medium");
  });

  it("sin pronóstico es medio", () => {
    expect(classifyRivalDifficulty(null)).toBe("medium");
  });

  it("usa los umbrales configurados", () => {
    expect(classifyRivalDifficulty(0.5, { hardBelow: 0.6, easyAbove: 0.9 })).toBe("hard");
  });
});

describe("describeCriterion", () => {
  it("explica el criterio de jornadas seguidas para el elegido y el no elegido", () => {
    const text = describeCriterion("consecutive", metrics({ consecutive: 5 }), metrics({ consecutive: 4 }), "Pedro", "Sergio");

    expect(text.chosen).toBe("lleva 5 jornadas seguidas convocado sin descansar");
    expect(text.compare).toBe("Pedro lleva 4");
    expect(text.notChosen).toBe("Se desconvoca a Sergio en su lugar: lleva más jornadas seguidas convocado (5 frente a 4)");
  });

  it("explica el criterio de nivel ante rival difícil", () => {
    const text = describeCriterion("rating", metrics({ rating: 5 }), metrics({ rating: 7 }), "Pedro", "Sergio", "hard");

    expect(text.chosen).toBe("tiene menor nivel (5) y el rival es difícil");
  });

  it("explica el nivel como último desempate cuando el rival no es difícil", () => {
    const text = describeCriterion("rating", metrics({ rating: 5 }), metrics({ rating: 7 }), "Pedro", "Sergio", "medium");

    expect(text.chosen).toBe("tiene menor nivel (5): es el último desempate");
    expect(text.notChosen).toBe("Se desconvoca a Sergio en su lugar: tiene menor nivel (5 frente a 7)");
  });

  it("da los valores de cada criterio para comparar con cada elegible", () => {
    expect(formatCriterionValues("consecutive", metrics({ consecutive: 6 }), metrics({ consecutive: 4 }))).toBe("6 frente a 4");
    expect(formatCriterionValues("attendance", metrics({ attendanceBucket: 6 }), metrics({ attendanceBucket: 9 }))).toBe("60% frente a 90%");
  });
});
