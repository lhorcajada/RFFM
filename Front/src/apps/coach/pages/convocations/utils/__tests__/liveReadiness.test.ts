import { describe, it, expect } from "vitest";
import { computeLiveReadiness } from "../liveReadiness";

describe("computeLiveReadiness", () => {
  it("devuelve null cuando no hay breakdown (jugador sin datos)", () => {
    expect(computeLiveReadiness(null, 20)).toBeNull();
  });

  it("con 0 minutos en vivo, devuelve el mismo resultado que el readiness original", () => {
    // trainingComponent 80, matchMinutesInWindow 140 de 560 esperados
    // matchComponent = 140/560*100 = 25
    // readiness original = round(0.7*80 + 0.3*25) = round(56 + 7.5) = round(63.5) = 64
    const breakdown = {
      trainingComponent: 80,
      matchMinutesInWindow: 140,
      matchMinutesExpected: 560,
    };
    const originalReadiness = 64;
    expect(computeLiveReadiness(breakdown, 0)).toBe(originalReadiness);
  });

  it("sube el resultado a medida que se acumulan minutos en vivo, nunca baja", () => {
    const breakdown = {
      trainingComponent: 50,
      matchMinutesInWindow: 0,
      matchMinutesExpected: 560,
    };
    const at0 = computeLiveReadiness(breakdown, 0)!;
    const at30 = computeLiveReadiness(breakdown, 30)!;
    const at90 = computeLiveReadiness(breakdown, 90)!;

    expect(at30).toBeGreaterThanOrEqual(at0);
    expect(at90).toBeGreaterThan(at30);
  });

  it("el componente de partido nunca supera 100 aunque los minutos en vivo lo superen", () => {
    const breakdown = {
      trainingComponent: 100,
      matchMinutesInWindow: 560, // ya al máximo
      matchMinutesExpected: 560,
    };
    // matchComponent ya está en 100; añadir minutos en vivo no debe subir de 100
    const result = computeLiveReadiness(breakdown, 500);
    expect(result).toBe(100);
  });

  it("no baja el resultado respecto al original al añadir minutos en vivo", () => {
    const breakdown = {
      trainingComponent: 90,
      matchMinutesInWindow: 280,
      matchMinutesExpected: 560,
    };
    const original = computeLiveReadiness(breakdown, 0)!;
    for (const liveMinutes of [1, 10, 45, 90, 200]) {
      expect(computeLiveReadiness(breakdown, liveMinutes)!).toBeGreaterThanOrEqual(original);
    }
  });

  it("ignora minutos en vivo negativos (los trata como 0)", () => {
    const breakdown = {
      trainingComponent: 60,
      matchMinutesInWindow: 100,
      matchMinutesExpected: 560,
    };
    expect(computeLiveReadiness(breakdown, -10)).toBe(computeLiveReadiness(breakdown, 0));
  });
});
