import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../core/api/client", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import client from "../../../core/api/client";
import { searchNotifications } from "../notificationService";

const getMock = vi.mocked(client.get);

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
});
