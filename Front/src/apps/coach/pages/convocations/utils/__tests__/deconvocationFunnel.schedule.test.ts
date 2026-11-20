import { describe, expect, it } from "vitest";
import { compareFairness, type FairnessMetrics } from "../deconvocationFunnel";

const metrics = (partial: Partial<FairnessMetrics>): FairnessMetrics => ({
  consecutive: 3,
  surplus: 1,
  technicalTotal: 0,
  attendanceBucket: 8,
  rating: 6,
  ...partial,
});

describe("compareFairness — calendario próximo", () => {
  const strong = metrics({ strong: true, rating: 8 });
  const normal = metrics({ strong: false, rating: 5 });

  it("con descanso de fuertes, el fuerte va antes que el normal", () => {
    const { order, criterion } = compareFairness(strong, normal, "easy", { restStrong: true });

    expect(order).toBeLessThan(0);
    expect(criterion).toBe("schedule");
  });

  it("no pasa por delante de las jornadas seguidas ni del excedente", () => {
    const { criterion } = compareFairness(metrics({ strong: true, consecutive: 2 }), metrics({ strong: false, consecutive: 5 }), "easy", { restStrong: true });

    expect(criterion).toBe("consecutive");
  });

  it("sin descanso de fuertes el criterio no se aplica", () => {
    expect(compareFairness(strong, normal, "easy").criterion).not.toBe("schedule");
  });

  it("entre dos fuertes o dos normales no decide", () => {
    expect(compareFairness(strong, metrics({ strong: true, rating: 8 }), "easy", { restStrong: true }).criterion).toBeNull();
  });
});
