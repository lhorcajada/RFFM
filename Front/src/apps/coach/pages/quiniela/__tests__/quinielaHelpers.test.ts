import { describe, expect, it } from "vitest";
import {
  formatJornadaDay,
  formatKickoff,
  formatMoney,
  goalsFromLabel,
  goalsToLabel,
  parseDonationAmount,
  parseWalletAmount,
  paymentMethodLabel,
  paymentStatusLabel,
  prizeCategoryFunds,
  ticketPaymentLabel,
  walletChargeMessage,
  walletMovementLabel,
} from "../quinielaHelpers";

describe("quinielaHelpers", () => {
  it("formatKickoff muestra día y hora de Madrid", () => {
    expect(formatKickoff("2026-10-31T09:00:00Z")).toMatch(/31 oct.*10:00/i);
  });

  it("formatJornadaDay muestra el día de la semana y la fecha dd/mm/yyyy de Madrid", () => {
    expect(formatJornadaDay("2026-11-07T15:00:00Z")).toBe("sábado 07/11/2026");
  });

  it("formatJornadaDay usa el día de Madrid aunque en UTC sea el anterior", () => {
    expect(formatJornadaDay("2026-11-07T23:30:00Z")).toBe("domingo 08/11/2026");
  });

  it("formatJornadaDay devuelve cadena vacía si no hay fecha", () => {
    expect(formatJornadaDay(null)).toBe("");
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
    expect(walletMovementLabel("Prize")).toBe("Premio");
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

  describe("parseDonationAmount", () => {
    it.each([
      ["0,01", 5, 0.01],
      ["25", 25, 25],
      [" 3,25 ", 10, 3.25],
    ])("acepta %s con saldo %s", (text, balance, value) => {
      expect(parseDonationAmount(text, balance)).toEqual({ value });
    });

    it.each([
      ["", 5],
      ["abc", 5],
      ["0", 5],
      ["-1", 5],
      ["1,234", 5],
      ["5,01", 5],
    ])("rechaza «%s» con saldo %s", (text, balance) => {
      expect(parseDonationAmount(text, balance)).toHaveProperty("error");
    });
  });

  it("walletMovementLabel nombra la donación", () => {
    expect(walletMovementLabel("Donation")).toBe("Donación");
  });

  it("walletChargeMessage indica importe cobrado y saldo restante", () => {
    expect(walletChargeMessage({ amount: 1, balanceAfter: 2 })).toMatch(/Se han cobrado 1,00\s€ de tu monedero\. Saldo: 2,00\s€/);
  });
});

describe("prizeCategoryFunds", () => {
  it("reparte la bolsa entre las cuatro categorías según sus pesos", () => {
    expect(prizeCategoryFunds(38.5)).toEqual({ Special: 7.5, First: 16, Second: 7.5, Third: 7.5 });
  });

  it("trunca cada importe al céntimo, como la liquidación", () => {
    expect(prizeCategoryFunds(10)).toEqual({ Special: 1.94, First: 4.15, Second: 1.94, Third: 1.94 });
  });
});
