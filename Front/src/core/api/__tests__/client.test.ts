import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../apps/coach/services/authService", () => ({
  coachAuthService: {
    logout: vi.fn(),
    isAuthenticated: vi.fn(() => true),
  },
}));

import client, { registerNavigate } from "../client";
import { coachAuthService } from "../../../apps/coach/services/authService";

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

describe("client response interceptor — peticiones abortadas al descargar la página", () => {
  const navigateMock = vi.fn();

  beforeEach(() => {
    navigateMock.mockClear();
    sessionStorage.clear();
    localStorage.clear();
    vi.mocked(coachAuthService.logout).mockClear();
    registerNavigate(navigateMock);
  });

  it("no cuenta como error de red ni cierra sesión si la página se está descargando", async () => {
    const rejected = getResponseErrorHandler();
    window.dispatchEvent(new Event("pagehide"));

    await expect(
      rejected({ message: "Network Error", code: "ERR_NETWORK", config: {} })
    ).rejects.toBeDefined();
    await expect(
      rejected({ message: "Network Error", code: "ERR_NETWORK", config: {} })
    ).rejects.toBeDefined();

    expect(navigateMock).not.toHaveBeenCalled();
    expect(coachAuthService.logout).not.toHaveBeenCalled();
  });

  it("vuelve a gestionar errores de red si la página se restaura (bfcache)", async () => {
    const rejected = getResponseErrorHandler();
    window.dispatchEvent(new Event("pagehide"));
    window.dispatchEvent(new Event("pageshow"));

    await expect(
      rejected({ message: "Network Error", code: "ERR_NETWORK", config: {} })
    ).rejects.toBeDefined();

    expect(navigateMock).toHaveBeenCalledWith(expect.stringContaining("reason=network"));
  });
});

describe("client response interceptor — bucle de errores 500", () => {
  const navigateMock = vi.fn();

  beforeEach(() => {
    navigateMock.mockClear();
    sessionStorage.clear();
    localStorage.clear();
    vi.mocked(coachAuthService.logout).mockClear();
    registerNavigate(navigateMock);
  });

  it("en el primer 500 va a /error-500 sin cerrar la sesión", async () => {
    const rejected = getResponseErrorHandler();

    await expect(
      rejected({ response: { status: 500 }, config: {} })
    ).rejects.toBeDefined();

    expect(navigateMock).toHaveBeenCalledWith(expect.stringContaining("/error-500"));
    expect(coachAuthService.logout).not.toHaveBeenCalled();
  });

  it("en el segundo 500 seguido limpia la sesión y va a /login", async () => {
    localStorage.setItem("rffm_user", "x");
    const rejected = getResponseErrorHandler();

    await expect(rejected({ response: { status: 500 }, config: {} })).rejects.toBeDefined();
    await expect(rejected({ response: { status: 500 }, config: {} })).rejects.toBeDefined();

    expect(coachAuthService.logout).toHaveBeenCalled();
    expect(localStorage.getItem("rffm_user")).toBeNull();
    expect(navigateMock).toHaveBeenLastCalledWith("/login");
  });

  it("tras recuperarse, un nuevo 500 vuelve a ir a /error-500", async () => {
    const rejected = getResponseErrorHandler();

    await expect(rejected({ response: { status: 500 }, config: {} })).rejects.toBeDefined();
    await expect(rejected({ response: { status: 500 }, config: {} })).rejects.toBeDefined();
    navigateMock.mockClear();
    await expect(rejected({ response: { status: 500 }, config: {} })).rejects.toBeDefined();

    expect(navigateMock).toHaveBeenCalledWith(expect.stringContaining("/error-500"));
  });
});
