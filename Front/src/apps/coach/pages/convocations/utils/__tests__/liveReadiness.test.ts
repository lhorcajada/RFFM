import { describe, it, expect } from "vitest";
import { computeLiveReadiness } from "../liveReadiness";

const breakdown = (value: number) => ({
  value,
  gainRate: 0.1,
  matchLoadPerReferenceMatch: 1.5,
  referenceMatchMinutes: 70,
});

describe("computeLiveReadiness", () => {
  it("devuelve null cuando no hay breakdown (jugador sin datos)", () => {
    expect(computeLiveReadiness(null, 20)).toBeNull();
  });

  it("con 0 minutos en vivo devuelve el rodaje actual redondeado", () => {
    expect(computeLiveReadiness(breakdown(63.5), 0)).toBe(64);
  });

  it("suma los minutos en vivo con la misma saturación que el backend", () => {
    // 100 − 50 · e^(−0.1 · 1.5 · 70/70) = 56.96
    expect(computeLiveReadiness(breakdown(50), 70)).toBe(57);
  });

  it("sube a medida que se acumulan minutos en vivo, nunca baja", () => {
    const at0 = computeLiveReadiness(breakdown(50), 0)!;
    const at30 = computeLiveReadiness(breakdown(50), 30)!;
    const at90 = computeLiveReadiness(breakdown(50), 90)!;

    expect(at30).toBeGreaterThan(at0);
    expect(at90).toBeGreaterThan(at30);
  });

  it("nunca supera 100", () => {
    expect(computeLiveReadiness(breakdown(99), 500)).toBe(100);
  });

  it("ignora minutos en vivo negativos (los trata como 0)", () => {
    expect(computeLiveReadiness(breakdown(60), -10)).toBe(computeLiveReadiness(breakdown(60), 0));
  });
});
