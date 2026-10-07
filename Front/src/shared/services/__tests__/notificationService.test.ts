import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../core/api/client", () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import client from "../../../core/api/client";
import {
  deleteAllNotifications,
  deleteNotifications,
  markAllNotificationsRead,
  searchNotifications,
} from "../notificationService";

const getMock = vi.mocked(client.get);
const postMock = vi.mocked(client.post);
const deleteMock = vi.mocked(client.delete);

describe("notificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue({ data: [], headers: { "x-total-count": "0" } });
  });

  it("por defecto mantiene la redirección global de errores", async () => {
    await searchNotifications(1, 20);

    expect(getMock).toHaveBeenCalledWith("/api/notifications", {
      params: { pageNumber: 1, pageSize: 20 },
      suppressErrorRedirect: false,
    });
  });

  it("permite desactivar la redirección a la página de error", async () => {
    await searchNotifications(1, 20, { suppressErrorRedirect: true });

    expect(getMock).toHaveBeenCalledWith("/api/notifications", {
      params: { pageNumber: 1, pageSize: 20 },
      suppressErrorRedirect: true,
    });
  });

  it("filtra las notificaciones por la app indicada", async () => {
    await searchNotifications(1, 20, { app: "coach" });

    expect(getMock).toHaveBeenCalledWith("/api/notifications", {
      params: { pageNumber: 1, pageSize: 20, app: "coach" },
      suppressErrorRedirect: false,
    });
  });

  it("marca como leídas todas las notificaciones de la app indicada", async () => {
    postMock.mockResolvedValue({ data: { marked: 3 } });

    const marked = await markAllNotificationsRead("federation");

    expect(postMock).toHaveBeenCalledWith("/api/notifications/read", null, {
      params: { app: "federation" },
    });
    expect(marked).toBe(3);
  });

  it("elimina las notificaciones indicadas y devuelve cuántas se borraron", async () => {
    deleteMock.mockResolvedValue({ data: { deleted: 2 } });

    const deleted = await deleteNotifications(["n1", "n2"]);

    expect(deleteMock).toHaveBeenCalledWith("/api/notifications", { data: { ids: ["n1", "n2"] } });
    expect(deleted).toBe(2);
  });

  it("elimina todas las notificaciones de la app indicada", async () => {
    deleteMock.mockResolvedValue({ data: { deleted: 40 } });

    const deleted = await deleteAllNotifications("coach");

    expect(deleteMock).toHaveBeenCalledWith("/api/notifications/all", { params: { app: "coach" } });
    expect(deleted).toBe(40);
  });
});
