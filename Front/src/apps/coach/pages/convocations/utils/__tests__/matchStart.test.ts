import { describe, expect, it } from "vitest";
import { hasMatchStarted } from "../matchStart";

describe("hasMatchStarted", () => {
  it("es false antes de la hora de inicio", () => {
    expect(hasMatchStarted("2026-11-16", "12:00", new Date(2026, 10, 16, 11, 59))).toBe(false);
  });

  it("es true a la hora exacta de inicio", () => {
    expect(hasMatchStarted("2026-11-16", "12:00", new Date(2026, 10, 16, 12, 0))).toBe(true);
  });

  it("es true después de la hora de inicio", () => {
    expect(hasMatchStarted("2026-11-16", "12:00", new Date(2026, 10, 17, 9, 0))).toBe(true);
  });

  it("sin hora conocida cuenta desde el comienzo del día", () => {
    expect(hasMatchStarted("2026-11-16", "", new Date(2026, 10, 16, 0, 1))).toBe(true);
    expect(hasMatchStarted("2026-11-16", "", new Date(2026, 10, 15, 23, 59))).toBe(false);
  });

  it("es false si no hay fecha", () => {
    expect(hasMatchStarted("", "12:00", new Date(2030, 0, 1))).toBe(false);
  });
});
