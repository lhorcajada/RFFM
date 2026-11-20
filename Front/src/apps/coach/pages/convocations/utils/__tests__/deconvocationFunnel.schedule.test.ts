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

describe("compareFairness — partido difícil por delante", () => {
  const strong = metrics({ strong: true, rating: 8 });
  const normal = metrics({ strong: false, rating: 5 });

  it("con un partido difícil por delante, el que no es importante va antes que el importante", () => {
    const { order, criterion } = compareFairness(normal, strong, "easy", { keepStrong: true });

    expect(order).toBeLessThan(0);
    expect(criterion).toBe("schedule");
    expect(compareFairness(strong, normal, "easy", { keepStrong: true }).order).toBeGreaterThan(0);
  });

  it("no pasa por delante de las jornadas seguidas ni del excedente", () => {
    const { criterion } = compareFairness(metrics({ strong: true, consecutive: 5 }), metrics({ strong: false, consecutive: 2 }), "easy", { keepStrong: true });

    expect(criterion).toBe("consecutive");
  });

  it("sin partido difícil por delante el criterio no se aplica", () => {
    expect(compareFairness(normal, strong, "easy").criterion).not.toBe("schedule");
  });

  it("entre dos importantes o dos normales no decide", () => {
    expect(compareFairness(strong, metrics({ strong: true, rating: 8 }), "easy", { keepStrong: true }).criterion).toBeNull();
  });
});
