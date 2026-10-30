import { describe, expect, it } from "vitest";
import {
  formatKickoff,
  formatMoney,
  goalsFromLabel,
  goalsToLabel,
  parseWalletAmount,
  paymentMethodLabel,
  paymentStatusLabel,
  ticketPaymentLabel,
  walletChargeMessage,
  walletMovementLabel,
} from "../quinielaHelpers";

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

  it("muestra «Pagado con monedero» solo si el boleto pagado usó el monedero", () => {
    expect(ticketPaymentLabel("Paid", "Wallet")).toBe("Pagado con monedero");
    expect(ticketPaymentLabel("Paid", "Cash")).toBe("Pagado");
    expect(ticketPaymentLabel("Pending", null)).toBe("Pendiente de pago");
  });

  it("traduce el método Monedero", () => {
    expect(paymentMethodLabel("Wallet")).toBe("Monedero");
  });

  it("traduce los tipos de movimiento del monedero", () => {
    expect(walletMovementLabel("TopUp")).toBe("Recarga");
    expect(walletMovementLabel("Adjustment")).toBe("Ajuste");
    expect(walletMovementLabel("TicketCharge")).toBe("Cobro de boleto");
    expect(walletMovementLabel("TicketRefund")).toBe("Reembolso de boleto");
  });

  describe("parseWalletAmount", () => {
    it.each([
      ["0,01", 0.01],
      ["10", 10],
      ["2.5", 2.5],
      [" 3,25 ", 3.25],
    ])("acepta %s", (text, value) => {
      expect(parseWalletAmount(text)).toEqual({ value });
    });

    it.each(["", "abc", "0", "0,00", "10,01", "11", "-1", "1,234"])("rechaza «%s»", (text) => {
      expect(parseWalletAmount(text)).toHaveProperty("error");
    });
  });

  it("walletChargeMessage indica importe cobrado y saldo restante", () => {
    expect(walletChargeMessage({ amount: 1, balanceAfter: 2 })).toMatch(/Se han cobrado 1,00\s€ de tu monedero\. Saldo: 2,00\s€/);
  });
});
