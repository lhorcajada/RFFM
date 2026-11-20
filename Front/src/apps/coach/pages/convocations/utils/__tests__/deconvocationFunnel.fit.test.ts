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
  return { share: 0.5, place: 2, total: 3, positionLabel: "Mediocentro", position: "midfielder", value: 3.6, ...partial };
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
  it("desconvoca antes al que tiene peor encaje cuando lo demás empata", () => {
    const worst = metrics({ fit: fit({ value: 2.6 }) });
    const best = metrics({ fit: fit({ value: 3.3 }) });

    expect(compareFairness(worst, best, "medium")).toMatchObject({ criterion: "fit" });
    expect(compareFairness(worst, best, "medium").order).toBeLessThan(0);
    expect(compareFairness(best, worst, "medium").order).toBeGreaterThan(0);
  });

  it("compara la nota de rasgos y no el lugar en la lista del puesto", () => {
    const secondOfFive = metrics({ fit: fit({ share: 0.75, place: 2, total: 5, value: 3.3 }) });
    const lastOfTwo = metrics({ fit: fit({ share: 0, place: 2, total: 2, value: 4.1 }) });

    expect(compareFairness(secondOfFive, lastOfTwo, "medium").order).toBeLessThan(0);
  });

  it("las jornadas seguidas deciden antes que el encaje", () => {
    const longStreakBestFit = metrics({ consecutive: 9, fit: fit({ value: 4.5 }) });
    const shortStreakWorstFit = metrics({ consecutive: 1, fit: fit({ value: 2.0 }) });

    expect(compareFairness(longStreakBestFit, shortStreakWorstFit, "medium")).toMatchObject({ criterion: "consecutive" });
    expect(compareFairness(longStreakBestFit, shortStreakWorstFit, "medium").order).toBeLessThan(0);
  });

  it("el excedente de convocatorias decide antes que el encaje", () => {
    const moreSurplus = metrics({ surplus: 4, fit: fit({ value: 4.5 }) });
    const lessSurplus = metrics({ surplus: 1, fit: fit({ value: 2.0 }) });

    expect(compareFairness(moreSurplus, lessSurplus, "medium")).toMatchObject({ criterion: "surplus" });
  });

  it("el encaje decide antes que la asistencia y las técnicas", () => {
    const worst = metrics({ technicalTotal: 0, attendanceBucket: 10, fit: fit({ value: 2.0 }) });
    const best = metrics({ technicalTotal: 5, attendanceBucket: 2, fit: fit({ value: 4.0 }) });

    expect(compareFairness(worst, best, "medium")).toMatchObject({ criterion: "fit" });
  });

  it("contra un rival difícil, con el mismo nivel, el encaje va después de las jornadas y el excedente", () => {
    const worst = metrics({ fit: fit({ value: 2.0 }) });
    const best = metrics({ fit: fit({ value: 4.0 }) });

    expect(compareFairness(worst, best, "hard").criterion).toBe("fit");
    expect(compareFairness(metrics({ consecutive: 8, fit: fit({ value: 4.0 }) }), metrics({ fit: fit({ value: 2.0 }) }), "hard").criterion).toBe(
      "consecutive",
    );
  });

  it("diferencias menores que la décima mostrada se consideran empate", () => {
    const a = metrics({ rating: 5, fit: fit({ value: 3.31 }) });
    const b = metrics({ rating: 7, fit: fit({ value: 3.34 }) });

    expect(compareFairness(a, b, "medium")).toMatchObject({ criterion: "rating" });
  });

  it("sin nota de encaje usa el lugar del orden confirmado", () => {
    const worst = metrics({ fit: fit({ share: 0, value: null }) });
    const best = metrics({ fit: fit({ share: 1, value: null }) });

    expect(compareFairness(worst, best, "medium")).toMatchObject({ criterion: "fit" });
  });

  it("sin información de encaje decide la equidad como antes", () => {
    const a = metrics({ technicalTotal: 0 });
    const b = metrics({ technicalTotal: 3 });

    expect(compareFairness(a, b, "medium")).toMatchObject({ criterion: "technicalTotal" });
  });

  it("un jugador sin encaje no se compara con la nota de otro", () => {
    const noFit = metrics({ technicalTotal: 0 });
    const withFit = metrics({ technicalTotal: 3, fit: fit({ value: 2.0 }) });

    expect(compareFairness(noFit, withFit, "medium")).toMatchObject({ criterion: "technicalTotal" });
  });
});

describe("textos del criterio de encaje", () => {
  const worst = metrics({ fit: fit({ share: 0, place: 3, total: 3, positionLabel: "Lateral", value: 2.6 }) });
  const best = metrics({ fit: fit({ share: 1, place: 1, total: 3, positionLabel: "Mediapunta", value: 3.3 }) });

  it("lo nombra entre los criterios", () => {
    expect(CRITERION_NAMES.fit).toBe("encaje por rasgos");
  });

  it("explica por qué se elige al de peor encaje con la nota de rasgos", () => {
    const text = describeCriterion("fit", worst, best, "Huguito", "Vargas");

    expect(text.chosen).toBe("tiene peor encaje por rasgos en su puesto (2,6 como Lateral)");
    expect(text.compare).toBe("Huguito: 3,3 como Mediapunta");
  });

  it("explica por qué el otro se queda", () => {
    const text = describeCriterion("fit", worst, best, "Huguito", "Vargas");

    expect(text.notChosen).toBe(
      "Se desconvoca a Vargas en su lugar: peor encaje por rasgos en su puesto (2,6 como Lateral frente a 3,3 como Mediapunta)",
    );
  });

  it("muestra los valores comparados", () => {
    expect(formatCriterionValues("fit", worst, best)).toBe("2,6 como Lateral frente a 3,3 como Mediapunta");
  });

  it("cuando uno no tiene encaje lo dice", () => {
    expect(formatCriterionValues("fit", worst, metrics())).toContain("sin encaje calculado");
  });
});
