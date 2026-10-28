import { describe, expect, it } from "vitest";
import { formatKickoff, formatMoney, goalsFromLabel, goalsToLabel, paymentStatusLabel } from "../quinielaHelpers";

describe("quinielaHelpers", () => {
  it("formatKickoff muestra día y hora de Madrid", () => {
    expect(formatKickoff("2026-10-31T09:00:00Z")).toMatch(/31 oct.*10:00/i);
  });

  it("formatKickoff devuelve «Sin horario» si no hay fecha", () => {
    expect(formatKickoff(null)).toBe("Sin horario");
  });

  it("formatMoney usa dos decimales y coma", () => {
    expect(formatMoney(11.5)).toMatch(/^11,50\s€$/);
  });

  it("convierte goles a etiqueta y viceversa (3 = M)", () => {
    expect(goalsToLabel(3)).toBe("M");
    expect(goalsToLabel(1)).toBe("1");
    expect(goalsFromLabel("M")).toBe(3);
    expect(goalsFromLabel("2")).toBe(2);
  });

  it("traduce los estados de pago", () => {
    expect(paymentStatusLabel("Pending")).toBe("Pendiente de pago");
    expect(paymentStatusLabel("Paid")).toBe("Pagado");
    expect(paymentStatusLabel("Expired")).toBe("Expirado");
  });
});
