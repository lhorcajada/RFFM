import { describe, expect, it } from "vitest";
import { computeEf, formTier, fatigueTier } from "../playerFormMetrics";

describe("computeEf", () => {
  it("devuelve null cuando readiness es null", () => {
    expect(computeEf(null, 30)).toBeNull();
  });

  it("calcula readiness - fatigue cuando ambos son válidos", () => {
    expect(computeEf(80, 30)).toBe(50);
  });

  it("nunca es negativo (clamp inferior a 0)", () => {
    expect(computeEf(20, 80)).toBe(0);
  });

  it("nunca supera 100 (clamp superior)", () => {
    expect(computeEf(150, -50)).toBe(100);
  });

  it("devuelve 0 cuando readiness y fatigue son iguales", () => {
    expect(computeEf(40, 40)).toBe(0);
  });
});

describe("formTier (Ef/Rodaje: valores altos son buenos)", () => {
  it("high cuando >= 80", () => {
    expect(formTier(80)).toBe("high");
    expect(formTier(100)).toBe("high");
  });

  it("mid cuando entre 50 y 79", () => {
    expect(formTier(50)).toBe("mid");
    expect(formTier(79)).toBe("mid");
  });

  it("low cuando < 50", () => {
    expect(formTier(49)).toBe("low");
    expect(formTier(0)).toBe("low");
  });
});

describe("fatigueTier (Cansancio: valores altos son malos, criterio invertido)", () => {
  it("low (rojo) cuando >= 70", () => {
    expect(fatigueTier(70)).toBe("low");
    expect(fatigueTier(100)).toBe("low");
  });

  it("mid (ambar) cuando entre 40 y 69", () => {
    expect(fatigueTier(40)).toBe("mid");
    expect(fatigueTier(69)).toBe("mid");
  });

  it("high (verde) cuando < 40", () => {
    expect(fatigueTier(39)).toBe("high");
    expect(fatigueTier(0)).toBe("high");
  });
});
