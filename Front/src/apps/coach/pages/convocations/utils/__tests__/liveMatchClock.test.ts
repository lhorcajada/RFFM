import { describe, it, expect } from "vitest";
import type { LiveMatchServerClock } from "../../components/simulation/liveMatch.types";
import { computeElapsedSeconds, computeServerOffsetMs } from "../liveMatchClock";

const T = "2026-11-04T10:00:00.000Z";
const TMs = Date.parse(T);

describe("computeElapsedSeconds", () => {
  it("suma los segundos transcurridos desde la referencia cuando el reloj está en marcha", () => {
    const clock: LiveMatchServerClock = { baseSeconds: 600, referenceUtc: T };

    expect(computeElapsedSeconds(clock, 0, TMs + 90_000)).toBe(690);
  });

  it("devuelve siempre los segundos base cuando el reloj está parado (referenceUtc null)", () => {
    const clock: LiveMatchServerClock = { baseSeconds: 600, referenceUtc: null };

    expect(computeElapsedSeconds(clock, 0, TMs)).toBe(600);
    expect(computeElapsedSeconds(clock, 0, TMs + 3_600_000)).toBe(600);
  });

  it("corrige un dispositivo adelantado 20 s para mostrar el mismo tiempo que un dispositivo correcto", () => {
    const clock: LiveMatchServerClock = { baseSeconds: 600, referenceUtc: T };
    const correctDeviceNow = TMs + 90_000;
    const skewedDeviceNow = correctDeviceNow + 20_000;
    const offset = computeServerOffsetMs(T, TMs + 20_000);

    expect(computeElapsedSeconds(clock, 0, correctDeviceNow)).toBe(690);
    expect(computeElapsedSeconds(clock, offset, skewedDeviceNow)).toBe(690);
  });

  it("nunca devuelve un valor negativo y redondea hacia abajo a segundos enteros", () => {
    const clock: LiveMatchServerClock = { baseSeconds: 600, referenceUtc: T };

    expect(computeElapsedSeconds(clock, 0, TMs + 1_900)).toBe(601);
    expect(computeElapsedSeconds({ baseSeconds: 0, referenceUtc: T }, 0, TMs - 5_000)).toBe(0);
  });
});

describe("computeServerOffsetMs", () => {
  it("devuelve -20000 cuando el dispositivo va 20 s por delante del servidor", () => {
    const deviceReceivedAtMs = TMs + 20_000;

    expect(computeServerOffsetMs(T, deviceReceivedAtMs)).toBe(-20_000);
  });
});
