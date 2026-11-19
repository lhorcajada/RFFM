import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  traceAuth,
  getAuthTrace,
  clearAuthTrace,
  formatAuthTrace,
  AUTH_TRACE_KEY,
  MAX_TRACE_ENTRIES,
} from "../authTrace";

describe("authTrace", () => {
  beforeEach(() => {
    localStorage.clear();
    clearAuthTrace();
  });

  it("registra un evento con fecha y datos", () => {
    traceAuth("login.success", { exp: 123 });

    const entries = getAuthTrace();
    expect(entries).toHaveLength(1);
    expect(entries[0].event).toBe("login.success");
    expect(entries[0].data).toEqual({ exp: 123 });
    expect(typeof entries[0].at).toBe("string");
  });

  it("limita el número de entradas conservando las más recientes", () => {
    for (let i = 0; i < MAX_TRACE_ENTRIES + 10; i++) traceAuth(`e${i}`);

    const entries = getAuthTrace();
    expect(entries).toHaveLength(MAX_TRACE_ENTRIES);
    expect(entries[entries.length - 1].event).toBe(`e${MAX_TRACE_ENTRIES + 9}`);
  });

  it("sigue funcionando en memoria cuando localStorage lanza excepciones", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(() => traceAuth("storage.blocked")).not.toThrow();
    expect(getAuthTrace().map((e) => e.event)).toContain("storage.blocked");
    spy.mockRestore();
  });

  it("persiste las trazas en localStorage", () => {
    traceAuth("a");
    expect(localStorage.getItem(AUTH_TRACE_KEY)).toContain('"a"');
  });

  it("formatea el diagnóstico como texto con una línea por evento", () => {
    traceAuth("x", { k: 1 });
    traceAuth("y");

    const text = formatAuthTrace();
    expect(text.split("\n").filter((l) => /Z (x|y)( |$)/.test(l))).toHaveLength(2);
    expect(text).toContain('{"k":1}');
  });

  it("clearAuthTrace vacía el registro", () => {
    traceAuth("a");
    clearAuthTrace();
    expect(getAuthTrace()).toEqual([]);
  });
});
