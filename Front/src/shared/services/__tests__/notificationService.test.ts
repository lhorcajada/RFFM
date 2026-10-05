import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../core/api/client", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import client from "../../../core/api/client";
import { markAllNotificationsRead, searchNotifications } from "../notificationService";

const getMock = vi.mocked(client.get);
const postMock = vi.mocked(client.post);

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
});
