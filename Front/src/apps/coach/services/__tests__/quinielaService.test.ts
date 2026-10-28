import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import client from "../../../../core/api/client";
import {
  deleteMyQuinielaTicket,
  deleteQuinielaTicket,
  getCurrentQuiniela,
  getQuinielaPayments,
  openQuiniela,
  resetQuiniela,
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
});
