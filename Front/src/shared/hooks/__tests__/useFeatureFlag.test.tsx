import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FEATURE_FLAGS } from "../../services/featureFlagsService";

const getFeatureFlags = vi.fn();
vi.mock("../../services/featureFlagsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/featureFlagsService")>()),
  getFeatureFlags: (...args: unknown[]) => getFeatureFlags(...args),
}));

import { resetFeatureFlagsCache, useFeatureFlag } from "../useFeatureFlag";

describe("useFeatureFlag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFeatureFlagsCache();
  });

  it("empieza cargando y con el flag apagado", () => {
    getFeatureFlags.mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useFeatureFlag(FEATURE_FLAGS.QuinielaMultipleTickets));

    expect(result.current).toEqual({ enabled: false, loading: true });
  });

  it("devuelve true cuando el servidor lo activa", async () => {
    getFeatureFlags.mockResolvedValue({ QuinielaMultipleTickets: true });
    const { result } = renderHook(() => useFeatureFlag(FEATURE_FLAGS.QuinielaMultipleTickets));

    await waitFor(() => expect(result.current).toEqual({ enabled: true, loading: false }));
  });

  it("devuelve false cuando el servidor lo tiene apagado", async () => {
    getFeatureFlags.mockResolvedValue({ QuinielaMultipleTickets: false });
    const { result } = renderHook(() => useFeatureFlag(FEATURE_FLAGS.QuinielaMultipleTickets));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.enabled).toBe(false);
  });

  it("trata un flag que el servidor no conoce como apagado", async () => {
    getFeatureFlags.mockResolvedValue({});
    const { result } = renderHook(() => useFeatureFlag(FEATURE_FLAGS.QuinielaMultipleTickets));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.enabled).toBe(false);
  });

  it("si falla la consulta deja el flag apagado", async () => {
    getFeatureFlags.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useFeatureFlag(FEATURE_FLAGS.QuinielaMultipleTickets));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.enabled).toBe(false);
  });

  it("tras un fallo vuelve a consultar en el siguiente uso", async () => {
    getFeatureFlags.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ QuinielaMultipleTickets: true });
    const first = renderHook(() => useFeatureFlag(FEATURE_FLAGS.QuinielaMultipleTickets));
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    const second = renderHook(() => useFeatureFlag(FEATURE_FLAGS.QuinielaMultipleTickets));

    await waitFor(() => expect(second.result.current.enabled).toBe(true));
    expect(getFeatureFlags).toHaveBeenCalledTimes(2);
  });

  it("comparte una sola petición entre todos los usos", async () => {
    getFeatureFlags.mockResolvedValue({ QuinielaMultipleTickets: true });
    const first = renderHook(() => useFeatureFlag(FEATURE_FLAGS.QuinielaMultipleTickets));
    const second = renderHook(() => useFeatureFlag(FEATURE_FLAGS.QuinielaMultipleTickets));

    await waitFor(() => expect(first.result.current.enabled).toBe(true));
    await waitFor(() => expect(second.result.current.enabled).toBe(true));
    expect(getFeatureFlags).toHaveBeenCalledTimes(1);
  });
});
