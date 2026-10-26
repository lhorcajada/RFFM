import { describe, expect, it } from "vitest";
import { parseRecoveryDays, recoveryProgress } from "../injuryRecovery";

describe("parseRecoveryDays", () => {
  it.each([
    ["2 semanas", 14],
    ["1 semana", 7],
    ["10 días", 10],
    ["10 dias", 10],
    ["1 día", 1],
    ["2 meses", 60],
    ["1 mes", 30],
    ["  3 Semanas ", 21],
  ])("interpreta %s como %i días", (text, days) => {
    expect(parseRecoveryDays(text)).toBe(days);
  });

  it.each([
    ["3-4 semanas", 28],
    ["3 – 4 semanas", 28],
    ["3 a 4 semanas", 28],
    ["1-2 meses", 60],
  ])("usa el extremo superior del rango %s", (text, days) => {
    expect(parseRecoveryDays(text)).toBe(days);
  });

  it.each([
    [null],
    [undefined],
    [""],
    ["unas semanas"],
    ["hasta nueva revisión"],
    ["3 semanas aprox."],
    ["0 semanas"],
    ["4"],
  ])("devuelve null para texto no interpretable (%s)", (text) => {
    expect(parseRecoveryDays(text)).toBeNull();
  });
});

describe("recoveryProgress", () => {
  const now = new Date("2026-10-15T00:00:00Z");

  it("calcula el porcentaje transcurrido sobre el total", () => {
    expect(recoveryProgress("2026-10-08T00:00:00Z", "2 semanas", now)).toBe(50);
  });

  it("usa el extremo superior de un rango", () => {
    expect(recoveryProgress("2026-10-01T00:00:00Z", "3-4 semanas", now)).toBe(50);
  });

  it("nunca supera 99 mientras la lesión sigue activa", () => {
    expect(recoveryProgress("2026-01-01T00:00:00Z", "2 semanas", now)).toBe(99);
  });

  it("no baja de 0 si la fecha de inicio es futura", () => {
    expect(recoveryProgress("2026-11-01T00:00:00Z", "2 semanas", now)).toBe(0);
  });

  it("devuelve null si la estimación no es interpretable", () => {
    expect(recoveryProgress("2026-10-08T00:00:00Z", "hasta nueva revisión", now)).toBeNull();
  });

  it("devuelve null si la fecha de inicio es inválida", () => {
    expect(recoveryProgress("no-es-fecha", "2 semanas", now)).toBeNull();
  });
});
