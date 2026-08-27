import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useSessionForm } from "../useSessionForm";

vi.mock("../../../../../services/trainingService", () => ({
  default: {
    getSessionById: vi.fn(),
    createSession: vi.fn(),
    updateSession: vi.fn(),
  },
}));

const navigate = vi.fn();

describe("useSessionForm — validación al guardar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("bloquea el guardado cuando falta el nombre", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    const { result } = renderHook(() =>
      useSessionForm({ teamId: "team-1", navigate, returnTo: "/coach/trainings" })
    );

    act(() => result.current.setField("date", "2026-09-01"));
    act(() =>
      result.current.setField("blocks", [
        { order: 1, nombre: "Bloque 1", comoConectaConAnterior: "Primer bloque", rotacionEntreEjercicios: null, exercises: [{ exerciseId: "ex-1", position: 1 }] },
      ])
    );

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.error).toMatch(/nombre/i);
    expect(trainingService.createSession).not.toHaveBeenCalled();
  });

  it("bloquea el guardado cuando un bloque no tiene 'Cómo conecta con el anterior', incluso el primero", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    const { result } = renderHook(() =>
      useSessionForm({ teamId: "team-1", navigate, returnTo: "/coach/trainings" })
    );

    act(() => result.current.setField("name", "Sesión 1"));
    act(() => result.current.setField("date", "2026-09-01"));
    act(() =>
      result.current.setField("blocks", [
        { order: 1, nombre: "Bloque 1", comoConectaConAnterior: "", rotacionEntreEjercicios: null, exercises: [{ exerciseId: "ex-1", position: 1 }] },
      ])
    );

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.error).toMatch(/conecta/i);
    expect(trainingService.createSession).not.toHaveBeenCalled();
  });

  it("bloquea el guardado cuando no hay ningún bloque", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    const { result } = renderHook(() =>
      useSessionForm({ teamId: "team-1", navigate, returnTo: "/coach/trainings" })
    );

    act(() => result.current.setField("name", "Sesión 1"));
    act(() => result.current.setField("date", "2026-09-01"));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.error).toMatch(/bloque/i);
    expect(trainingService.createSession).not.toHaveBeenCalled();
  });

  it("guarda correctamente sin microcicloId (sesión independiente del plan)", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (trainingService.createSession as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sess-new" });
    const { result } = renderHook(() =>
      useSessionForm({ teamId: "team-1", navigate, returnTo: "/coach/trainings" })
    );

    act(() => result.current.setField("name", "Sesión independiente"));
    act(() => result.current.setField("date", "2026-09-01"));
    act(() =>
      result.current.setField("blocks", [
        { order: 1, nombre: "Bloque 1", comoConectaConAnterior: "Primer bloque", rotacionEntreEjercicios: null, exercises: [{ exerciseId: "ex-1", position: 1 }] },
      ])
    );

    await act(async () => {
      await result.current.handleSave();
    });

    await waitFor(() => {
      expect(trainingService.createSession).toHaveBeenCalled();
    });
    const payload = (trainingService.createSession as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.microcicloId).toBeFalsy();
    expect(result.current.error).toBeNull();
  });
});
