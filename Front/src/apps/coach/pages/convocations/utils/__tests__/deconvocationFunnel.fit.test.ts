import { describe, expect, it } from "vitest";
import {
  compareFairness,
  CRITERION_NAMES,
  describeCriterion,
  fitShareOf,
  formatCriterionValues,
  formatFitPlace,
  type FairnessMetrics,
  type FitInfo,
} from "../deconvocationFunnel";

function fit(partial: Partial<FitInfo> = {}): FitInfo {
  return { share: 0.5, place: 2, total: 3, positionLabel: "Mediocentro", value: 3.6, ...partial };
}

function metrics(partial: Partial<FairnessMetrics> = {}): FairnessMetrics {
  return { consecutive: 3, surplus: 2, technicalTotal: 1, attendanceBucket: 8, rating: 6, ...partial };
}

describe("fitShareOf", () => {
  it("da 0 al peor, 1 al mejor y 0,5 al del medio", () => {
    expect(fitShareOf(3, 3)).toBe(0);
    expect(fitShareOf(2, 3)).toBe(0.5);
    expect(fitShareOf(1, 3)).toBe(1);
  });

  it("es neutro cuando el puesto solo tiene un candidato", () => {
    expect(fitShareOf(1, 1)).toBe(0.5);
  });
});

describe("formatFitPlace", () => {
  it("indica el lugar, el puesto y el encaje", () => {
    expect(formatFitPlace(fit({ place: 3, total: 3, positionLabel: "Mediocentro defensivo", value: 3.1 }))).toBe(
      "3.º de 3 en Mediocentro defensivo (3,1)",
    );
  });

  it("dice sin datos cuando no hay encaje calculado", () => {
    expect(formatFitPlace(fit({ value: null }))).toBe("2.º de 3 en Mediocentro (sin datos)");
  });
});

describe("compareFairness con encaje", () => {
  it("desconvoca antes al que tiene peor encaje en su puesto", () => {
    const worst = metrics({ fit: fit({ share: 0 }) });
    const best = metrics({ fit: fit({ share: 1 }) });

    expect(compareFairness(worst, best, "medium")).toMatchObject({ criterion: "fit" });
    expect(compareFairness(worst, best, "medium").order).toBeLessThan(0);
    expect(compareFairness(best, worst, "medium").order).toBeGreaterThan(0);
  });

  it("el encaje decide antes que las jornadas seguidas", () => {
    const worstFitFewStreak = metrics({ consecutive: 1, fit: fit({ share: 0 }) });
    const bestFitLongStreak = metrics({ consecutive: 9, fit: fit({ share: 1 }) });

    expect(compareFairness(worstFitFewStreak, bestFitLongStreak, "medium").order).toBeLessThan(0);
  });

  it("también decide primero contra un rival difícil", () => {
    const worst = metrics({ fit: fit({ share: 0 }) });
    const best = metrics({ fit: fit({ share: 1 }) });

    expect(compareFairness(worst, best, "hard").criterion).toBe("fit");
  });

  it("sin información de encaje decide la equidad como antes", () => {
    const a = metrics({ consecutive: 5 });
    const b = metrics({ consecutive: 2 });

    expect(compareFairness(a, b, "medium")).toMatchObject({ criterion: "consecutive" });
  });

  it("un jugador sin encaje cuenta como neutro frente a uno con encaje medio", () => {
    const noFit = metrics({ consecutive: 5 });
    const midFit = metrics({ consecutive: 2, fit: fit({ share: 0.5 }) });

    expect(compareFairness(noFit, midFit, "medium")).toMatchObject({ criterion: "consecutive" });
  });

  it("con el mismo lugar relativo desempata la equidad", () => {
    const a = metrics({ consecutive: 6, fit: fit({ share: 0 }) });
    const b = metrics({ consecutive: 2, fit: fit({ share: 0 }) });

    expect(compareFairness(a, b, "medium")).toMatchObject({ criterion: "consecutive" });
  });
});

describe("textos del criterio de encaje", () => {
  const worst = metrics({ fit: fit({ share: 0, place: 3, total: 3, positionLabel: "Mediocentro defensivo", value: 3.1 }) });
  const best = metrics({ fit: fit({ share: 1, place: 1, total: 3, positionLabel: "Mediocentro defensivo", value: 4.2 }) });

  it("lo nombra entre los criterios", () => {
    expect(CRITERION_NAMES.fit).toBe("encaje en el puesto");
  });

  it("explica por qué se elige al de peor encaje", () => {
    const text = describeCriterion("fit", worst, best, "Bruno", "Araque");

    expect(text.chosen).toContain("3.º de 3 en Mediocentro defensivo (3,1)");
    expect(text.compare).toContain("Bruno");
    expect(text.compare).toContain("1.º de 3 en Mediocentro defensivo (4,2)");
  });

  it("explica por qué el otro se queda", () => {
    const text = describeCriterion("fit", worst, best, "Bruno", "Araque");

    expect(text.notChosen).toBe(
      "Se desconvoca a Araque en su lugar: peor encaje en su puesto (3.º de 3 en Mediocentro defensivo (3,1) frente a 1.º de 3 en Mediocentro defensivo (4,2))",
    );
  });

  it("muestra los valores comparados", () => {
    expect(formatCriterionValues("fit", worst, best)).toBe(
      "3.º de 3 en Mediocentro defensivo (3,1) frente a 1.º de 3 en Mediocentro defensivo (4,2)",
    );
  });

  it("cuando uno no tiene orden de encaje lo dice", () => {
    expect(formatCriterionValues("fit", worst, metrics())).toContain("sin orden de encaje");
  });
});
