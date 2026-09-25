import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAutoRefresh from "../useAutoRefresh";

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useAutoRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ejecuta el refresco periódicamente mientras la pestaña está visible", () => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh(refresh, 1000));

    vi.advanceTimersByTime(3000);

    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("no refresca mientras la pestaña está oculta", () => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh(refresh, 1000));

    setVisibility("hidden");
    vi.advanceTimersByTime(5000);

    expect(refresh).not.toHaveBeenCalled();
  });

  it("refresca inmediatamente al volver a la pestaña", () => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh(refresh, 1000));

    setVisibility("hidden");
    setVisibility("visible");

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("no refresca cuando está deshabilitado", () => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh(refresh, 1000, false));

    vi.advanceTimersByTime(5000);

    expect(refresh).not.toHaveBeenCalled();
  });

  it("deja de refrescar al desmontarse", () => {
    const refresh = vi.fn();
    const { unmount } = renderHook(() => useAutoRefresh(refresh, 1000));

    unmount();
    vi.advanceTimersByTime(5000);

    expect(refresh).not.toHaveBeenCalled();
  });

  it("usa siempre la última versión del callback", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }) => useAutoRefresh(cb, 1000), {
      initialProps: { cb: first },
    });

    rerender({ cb: second });
    vi.advanceTimersByTime(1000);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
