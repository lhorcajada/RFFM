import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import client from "../../../../core/api/client";
import {
  adjustQuinielaWallet,
  deleteMyQuinielaTicket,
  deleteQuinielaTicket,
  getCurrentQuiniela,
  getMyQuinielaWallet,
  getQuinielaHistory,
  getQuinielaPayments,
  getQuinielaWalletOf,
  getQuinielaWallets,
  openQuiniela,
  payQuinielaTicketWithWallet,
  resetQuiniela,
  topUpQuinielaWallet,
  saveQuinielaTicket,
  setQuinielaTicketPayment,
  settleQuiniela,
} from "../quinielaService";

const mocked = client as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe("quinielaService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("getCurrentQuiniela hace GET a /quiniela/current y devuelve data", async () => {
    mocked.get.mockResolvedValue({ data: { isOpen: false } });
    const result = await getCurrentQuiniela("team 1");
    expect(mocked.get).toHaveBeenCalledWith("/api/teams/team%201/quiniela/current");
    expect(result).toEqual({ isOpen: false });
  });

  it("getQuinielaHistory hace GET a /quiniela/history con la paginación", async () => {
    mocked.get.mockResolvedValue({ data: { total: 0, items: [] } });
    const result = await getQuinielaHistory("team 1", { limit: 10, offset: 20 });
    expect(mocked.get).toHaveBeenCalledWith("/api/teams/team%201/quiniela/history", { params: { limit: 10, offset: 20 } });
    expect(result).toEqual({ total: 0, items: [] });
  });

  it("openQuiniela hace POST a /quiniela y devuelve la jornada", async () => {
    mocked.post.mockResolvedValue({ data: { id: "j1" } });
    const result = await openQuiniela("t1");
    expect(mocked.post).toHaveBeenCalledWith("/api/teams/t1/quiniela");
    expect(result).toEqual({ id: "j1" });
  });

  it("saveQuinielaTicket sin boleto hace POST a /my-tickets con el cuerpo", async () => {
    mocked.post.mockResolvedValue({ data: { id: "tk1" } });
    const body = { picks: [{ recordCode: "m1", sign: "1" as const }], plenoHome: 2, plenoAway: 3 };
    const result = await saveQuinielaTicket("t1", "j1", body);
    expect(mocked.post).toHaveBeenCalledWith("/api/teams/t1/quiniela/j1/my-tickets", body);
    expect(result).toEqual({ id: "tk1" });
  });

  it("saveQuinielaTicket con boleto hace PUT a /my-tickets/{id}", async () => {
    mocked.put.mockResolvedValue({ data: { id: "tk 1" } });
    const body = { picks: [{ recordCode: "m1", sign: "X" as const }], plenoHome: 0, plenoAway: 0 };
    const result = await saveQuinielaTicket("t1", "j1", body, "tk 1");
    expect(mocked.put).toHaveBeenCalledWith("/api/teams/t1/quiniela/j1/my-tickets/tk%201", body);
    expect(result).toEqual({ id: "tk 1" });
  });

  it("getQuinielaPayments hace GET a /payments", async () => {
    mocked.get.mockResolvedValue({ data: { tickets: [] } });
    const result = await getQuinielaPayments("t1", "j1");
    expect(mocked.get).toHaveBeenCalledWith("/api/teams/t1/quiniela/j1/payments");
    expect(result).toEqual({ tickets: [] });
  });

  it("setQuinielaTicketPayment hace PUT a /tickets/{id}/payment", async () => {
    mocked.put.mockResolvedValue({ data: { id: "tk1" } });
    const result = await setQuinielaTicketPayment("t1", "j1", "tk1", { paid: true, method: "Bizum" });
    expect(mocked.put).toHaveBeenCalledWith("/api/teams/t1/quiniela/j1/tickets/tk1/payment", {
      paid: true,
      method: "Bizum",
    });
    expect(result).toEqual({ id: "tk1" });
  });

  it("settleQuiniela hace POST a /settle", async () => {
    mocked.post.mockResolvedValue({ data: { carryOut: 1 } });
    const result = await settleQuiniela("t1", "j1");
    expect(mocked.post).toHaveBeenCalledWith("/api/teams/t1/quiniela/j1/settle");
    expect(result).toEqual({ carryOut: 1 });
  });

  it("deleteQuinielaTicket hace DELETE a /tickets/{id}", async () => {
    mocked.delete.mockResolvedValue({});
    await deleteQuinielaTicket("t1", "j1", "tk 1");
    expect(mocked.delete).toHaveBeenCalledWith("/api/teams/t1/quiniela/j1/tickets/tk%201");
  });

  it("deleteMyQuinielaTicket hace DELETE a /my-tickets/{id}", async () => {
    mocked.delete.mockResolvedValue({});
    await deleteMyQuinielaTicket("t1", "j1", "tk 1");
    expect(mocked.delete).toHaveBeenCalledWith("/api/teams/t1/quiniela/j1/my-tickets/tk%201");
  });

  it("resetQuiniela hace DELETE a la jornada", async () => {
    mocked.delete.mockResolvedValue({});
    await resetQuiniela("t1", "j1");
    expect(mocked.delete).toHaveBeenCalledWith("/api/teams/t1/quiniela/j1");
  });

  describe("monedero", () => {
    it("getMyQuinielaWallet hace GET a /wallet con limit y offset", async () => {
      mocked.get.mockResolvedValue({ data: { balance: 2 } });
      const result = await getMyQuinielaWallet("t1", { limit: 25, offset: 50 });
      expect(mocked.get).toHaveBeenCalledWith("/api/teams/t1/quiniela/wallet", { params: { limit: 25, offset: 50 } });
      expect(result).toEqual({ balance: 2 });
    });

    it("getMyQuinielaWallet usa limit 25 y offset 0 por defecto", async () => {
      mocked.get.mockResolvedValue({ data: {} });
      await getMyQuinielaWallet("t1");
      expect(mocked.get).toHaveBeenCalledWith("/api/teams/t1/quiniela/wallet", { params: { limit: 25, offset: 0 } });
    });

    it("getQuinielaWalletOf hace GET a /wallets/{userId}", async () => {
      mocked.get.mockResolvedValue({ data: { userId: "u 1" } });
      const result = await getQuinielaWalletOf("t1", "u 1", { limit: 10, offset: 0 });
      expect(mocked.get).toHaveBeenCalledWith("/api/teams/t1/quiniela/wallets/u%201", { params: { limit: 10, offset: 0 } });
      expect(result).toEqual({ userId: "u 1" });
    });

    it("getQuinielaWallets hace GET a /wallets", async () => {
      mocked.get.mockResolvedValue({ data: [{ userId: "u1" }] });
      const result = await getQuinielaWallets("t1");
      expect(mocked.get).toHaveBeenCalledWith("/api/teams/t1/quiniela/wallets");
      expect(result).toEqual([{ userId: "u1" }]);
    });

    it("topUpQuinielaWallet hace POST a /wallets/{userId}/top-ups", async () => {
      mocked.post.mockResolvedValue({ data: { balance: 3 } });
      const result = await topUpQuinielaWallet("t1", "u1", { amount: 3, description: "Bizum" });
      expect(mocked.post).toHaveBeenCalledWith("/api/teams/t1/quiniela/wallets/u1/top-ups", { amount: 3, description: "Bizum" });
      expect(result).toEqual({ balance: 3 });
    });

    it("adjustQuinielaWallet hace POST a /wallets/{userId}/adjustments", async () => {
      mocked.post.mockResolvedValue({ data: { balance: 1 } });
      const result = await adjustQuinielaWallet("t1", "u1", { amount: 2, reason: "Error" });
      expect(mocked.post).toHaveBeenCalledWith("/api/teams/t1/quiniela/wallets/u1/adjustments", { amount: 2, reason: "Error" });
      expect(result).toEqual({ balance: 1 });
    });

    it("payQuinielaTicketWithWallet hace POST a /wallet-payment sin cuerpo y devuelve el boleto", async () => {
      mocked.post.mockResolvedValue({ data: { id: "tk1", paymentStatus: "Paid" } });
      const result = await payQuinielaTicketWithWallet("t1", "j1", "tk 1");
      expect(mocked.post).toHaveBeenCalledWith("/api/teams/t1/quiniela/j1/my-tickets/tk%201/wallet-payment");
      expect(result).toEqual({ id: "tk1", paymentStatus: "Paid" });
    });
  });
});
