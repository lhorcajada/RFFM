import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../apps/coach/services/authService", () => ({
  coachAuthService: {
    logout: vi.fn(),
    isAuthenticated: vi.fn(() => true),
  },
}));

import client, { registerNavigate } from "../client";

function getResponseErrorHandler() {
  const handlers = (client.interceptors.response as any).handlers as Array<{
    rejected: (error: any) => Promise<any>;
  } | null>;
  const handler = handlers.find((h) => h && typeof h.rejected === "function");
  if (!handler) throw new Error("response error interceptor not registered");
  return handler.rejected;
}

describe("client response interceptor — suppressErrorRedirect", () => {
  const navigateMock = vi.fn();

  beforeEach(() => {
    navigateMock.mockClear();
    registerNavigate(navigateMock);
  });

  it("navega a /error-500 en un error 500 quando no se pide suprimirlo", async () => {
    const rejected = getResponseErrorHandler();

    await expect(
      rejected({ response: { status: 500 }, config: {} })
    ).rejects.toBeDefined();

    expect(navigateMock).toHaveBeenCalledWith(expect.stringContaining("/error-500"));
  });

  it("no navega en un error 500 cuando suppressErrorRedirect es true", async () => {
    const rejected = getResponseErrorHandler();

    await expect(
      rejected({ response: { status: 500 }, config: { suppressErrorRedirect: true } })
    ).rejects.toBeDefined();

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("no navega en un error de red cuando suppressErrorRedirect es true", async () => {
    const rejected = getResponseErrorHandler();

    await expect(
      rejected({
        message: "Network Error",
        code: "ERR_NETWORK",
        config: { suppressErrorRedirect: true },
      })
    ).rejects.toBeDefined();

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("no navega en un timeout cuando suppressErrorRedirect es true", async () => {
    const rejected = getResponseErrorHandler();

    await expect(
      rejected({ code: "ECONNABORTED", config: { suppressErrorRedirect: true } })
    ).rejects.toBeDefined();

    expect(navigateMock).not.toHaveBeenCalled();
  });
});
