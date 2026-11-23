import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetClientState } from "../resetClientState";
import { traceAuth, getAuthTrace, clearAuthTrace } from "../authTrace";

describe("resetClientState", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearAuthTrace();
  });

  it("borra localStorage y sessionStorage", async () => {
    localStorage.setItem("coachAuthToken", "t");
    localStorage.setItem("rffm_user", "{}");
    sessionStorage.setItem("rffm.error_redirects", "[1]");

    await resetClientState();

    expect(localStorage.getItem("coachAuthToken")).toBeNull();
    expect(localStorage.getItem("rffm_user")).toBeNull();
    expect(sessionStorage.getItem("rffm.error_redirects")).toBeNull();
  });

  it("conserva el registro de trazas y anota la limpieza", async () => {
    traceAuth("antes");

    await resetClientState();

    const events = getAuthTrace().map((e) => e.event);
    expect(events).toContain("antes");
    expect(events).toContain("client.reset");
  });

  it("da de baja los service workers y vacía las cachés cuando existen", async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const cacheDelete = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistrations: vi.fn().mockResolvedValue([{ unregister }]) },
    });
    Object.defineProperty(window, "caches", {
      configurable: true,
      value: { keys: vi.fn().mockResolvedValue(["a", "b"]), delete: cacheDelete },
    });

    await resetClientState();

    expect(unregister).toHaveBeenCalledTimes(1);
    expect(cacheDelete).toHaveBeenCalledTimes(2);
  });

  it("no falla si las APIs del navegador no están disponibles o rechazan", async () => {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistrations: vi.fn().mockRejectedValue(new Error("nope")) },
    });
    Object.defineProperty(window, "caches", { configurable: true, value: undefined });

    await expect(resetClientState()).resolves.toBeUndefined();
  });
});
