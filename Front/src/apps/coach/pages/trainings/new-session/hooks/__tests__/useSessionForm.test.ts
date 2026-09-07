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

  it("guarda correctamente una sesión con fecha pero sin ningún bloque", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (trainingService.createSession as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sess-new" });
    const { result } = renderHook(() =>
      useSessionForm({ teamId: "team-1", navigate, returnTo: "/coach/trainings" })
    );

    act(() => result.current.setField("name", "Sesión 1"));
    act(() => result.current.setField("date", "2026-09-01"));

    await act(async () => {
      await result.current.handleSave();
    });

    await waitFor(() => {
      expect(trainingService.createSession).toHaveBeenCalled();
    });
    expect(result.current.error).toBeNull();
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

  it("guarda correctamente una sesión sin fecha (content-first, sin bloques) — design.md Decision 3.1", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (trainingService.createSession as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sess-new" });
    const { result } = renderHook(() =>
      useSessionForm({ teamId: "team-1", navigate, returnTo: "/coach/trainings" })
    );

    act(() => result.current.setField("name", "Sesión sin programar"));

    await act(async () => {
      await result.current.handleSave();
    });

    await waitFor(() => {
      expect(trainingService.createSession).toHaveBeenCalled();
    });
    expect(result.current.error).toBeNull();
  });

  it("guarda correctamente un bloque sin ningún ejercicio (sin exigencia mínima de contenido)", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (trainingService.createSession as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sess-new" });
    const { result } = renderHook(() =>
      useSessionForm({ teamId: "team-1", navigate, returnTo: "/coach/trainings" })
    );

    act(() => result.current.setField("name", "Sesión 1"));
    act(() => result.current.setField("date", "2026-09-01"));
    act(() =>
      result.current.setField("blocks", [
        { order: 1, nombre: "Bloque 1", comoConectaConAnterior: "Primer bloque", rotacionEntreEjercicios: null, exercises: [] },
      ])
    );

    await act(async () => {
      await result.current.handleSave();
    });

    await waitFor(() => {
      expect(trainingService.createSession).toHaveBeenCalled();
    });
    expect(result.current.error).toBeNull();
  });

  it("emite una notificación de éxito al guardar correctamente", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (trainingService.createSession as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sess-new" });
    const { result } = renderHook(() =>
      useSessionForm({ teamId: "team-1", navigate, returnTo: "/coach/trainings" })
    );

    const onSnackbar = vi.fn();
    window.addEventListener("rffm.show_snackbar", onSnackbar);

    act(() => result.current.setField("name", "Sesión 1"));
    act(() => result.current.setField("date", "2026-09-01"));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(onSnackbar).toHaveBeenCalledTimes(1);
    expect((onSnackbar.mock.calls[0][0] as CustomEvent).detail).toEqual({
      message: "Sesión guardada correctamente",
      severity: "success",
    });

    window.removeEventListener("rffm.show_snackbar", onSnackbar);
  });

  it("emite una notificación de error cuando el guardado falla", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (trainingService.createSession as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() =>
      useSessionForm({ teamId: "team-1", navigate, returnTo: "/coach/trainings" })
    );

    const onSnackbar = vi.fn();
    window.addEventListener("rffm.show_snackbar", onSnackbar);

    act(() => result.current.setField("name", "Sesión 1"));
    act(() => result.current.setField("date", "2026-09-01"));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(onSnackbar).toHaveBeenCalledTimes(1);
    expect((onSnackbar.mock.calls[0][0] as CustomEvent).detail).toEqual({
      message: "Error al guardar la sesión.",
      severity: "error",
    });
    expect(result.current.error).toBe("Error al guardar la sesión.");

    window.removeEventListener("rffm.show_snackbar", onSnackbar);
  });
});

describe("useSessionForm — targetSubSubPrincipioIds pasa intacto (design.md F9)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emptySession() incluye targetSubSubPrincipioIds vacío por defecto", () => {
    const { result } = renderHook(() =>
      useSessionForm({ teamId: "team-1", navigate, returnTo: "/coach/trainings" })
    );

    expect(result.current.form.targetSubSubPrincipioIds).toEqual([]);
  });

  it("loadSession() conserva los targetSubSubPrincipioIds existentes de la sesión cargada", async () => {
    const { result } = renderHook(() =>
      useSessionForm({ teamId: "team-1", navigate, returnTo: "/coach/trainings" })
    );

    act(() =>
      result.current.loadSession({
        id: "sess-1",
        name: "Sesión 1",
        description: "",
        date: "2026-09-01",
        startTime: "10:00",
        endTime: null,
        location: null,
        sportEventId: null,
        microcicloId: null,
        objetivoGeneral: null,
        mapaCampoTexto: null,
        urlImage: null,
        blocks: [],
        targets: [
          {
            subSubPrincipioId: "ssp-1",
            rol: "Central",
            numero: "1.1.1",
            subprincipioId: "sub-1",
            subprincipioTitulo: "Defensa organizada",
            zonaId: null,
            zonaLabel: null,
            principioId: "principle-1",
            principioTitulo: "Defensa organizada",
            gameMomentId: 1,
            gameMomentName: "Fase defensiva",
          },
        ],
      })
    );

    expect(result.current.form.targetSubSubPrincipioIds).toEqual(["ssp-1"]);
  });

  it("guardar tras asignar solo una fecha a una sesión ya cargada conserva sus targets (flujo 'Asignar fecha', design.md F9)", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (trainingService.updateSession as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useSessionForm({ teamId: "team-1", navigate, returnTo: "/coach/trainings" })
    );

    act(() =>
      result.current.loadSession({
        id: "sess-1",
        name: "Sesión sin programar",
        description: "",
        date: null,
        startTime: null,
        endTime: null,
        location: null,
        sportEventId: null,
        microcicloId: null,
        objetivoGeneral: null,
        mapaCampoTexto: null,
        urlImage: null,
        blocks: [
          { id: "b1", order: 1, nombre: "Bloque 1", comoConectaConAnterior: "Primero", rotacionEntreEjercicios: null, exercises: [{ id: "e1", exerciseId: "ex-1", position: 1 }] },
        ],
        targets: [
          {
            subSubPrincipioId: "ssp-1",
            rol: "Central",
            numero: "1.1.1",
            subprincipioId: "sub-1",
            subprincipioTitulo: "Defensa organizada",
            zonaId: null,
            zonaLabel: null,
            principioId: "principle-1",
            principioTitulo: "Defensa organizada",
            gameMomentId: 1,
            gameMomentName: "Fase defensiva",
          },
        ],
      })
    );

    act(() => result.current.setField("date", "2026-09-10"));
    act(() => result.current.setField("startTime", "10:00"));

    await act(async () => {
      await result.current.handleSave();
    });

    await waitFor(() => {
      expect(trainingService.updateSession).toHaveBeenCalled();
    });
    const payload = (trainingService.updateSession as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(payload.targetSubSubPrincipioIds).toEqual(["ssp-1"]);
    expect(payload.date).toBe("2026-09-10");
    expect(result.current.error).toBeNull();
  });
});

describe("useSessionForm — autorrelleno de 'Objetivo general' desde los targets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loadSession() autorrellena objetivoGeneral cuando está vacío y la sesión tiene targets", () => {
    const { result } = renderHook(() =>
      useSessionForm({ teamId: "team-1", navigate, returnTo: "/coach/trainings" })
    );

    act(() =>
      result.current.loadSession({
        id: "sess-1",
        name: "Sesión 1",
        description: "",
        date: "2026-09-01",
        startTime: "10:00",
        endTime: null,
        location: null,
        sportEventId: null,
        microcicloId: null,
        objetivoGeneral: null,
        mapaCampoTexto: null,
        urlImage: null,
        blocks: [],
        targets: [
          {
            subSubPrincipioId: "ssp-1",
            rol: "Central",
            numero: "1.1.1",
            subprincipioId: "sub-1",
            subprincipioTitulo: "Defensa organizada",
            zonaId: null,
            zonaLabel: null,
            principioId: "principle-1",
            principioTitulo: "Defensa organizada",
            gameMomentId: 1,
            gameMomentName: "Fase defensiva",
          },
          {
            subSubPrincipioId: "ssp-2",
            rol: "Lateral",
            numero: "1.1.2",
            subprincipioId: "sub-1",
            subprincipioTitulo: "Defensa organizada",
            zonaId: null,
            zonaLabel: null,
            principioId: "principle-1",
            principioTitulo: "Defensa organizada",
            gameMomentId: 1,
            gameMomentName: "Fase defensiva",
          },
        ],
      })
    );

    expect(result.current.form.objetivoGeneral).toBe("Defensa organizada: Central, Lateral.");
  });

  it("loadSession() NO pisa un objetivoGeneral ya guardado, aunque la sesión tenga targets", () => {
    const { result } = renderHook(() =>
      useSessionForm({ teamId: "team-1", navigate, returnTo: "/coach/trainings" })
    );

    act(() =>
      result.current.loadSession({
        id: "sess-1",
        name: "Sesión 1",
        description: "",
        date: "2026-09-01",
        startTime: "10:00",
        endTime: null,
        location: null,
        sportEventId: null,
        microcicloId: null,
        objetivoGeneral: "Texto histórico ya guardado",
        mapaCampoTexto: null,
        urlImage: null,
        blocks: [],
        targets: [
          {
            subSubPrincipioId: "ssp-1",
            rol: "Central",
            numero: "1.1.1",
            subprincipioId: "sub-1",
            subprincipioTitulo: "Defensa organizada",
            zonaId: null,
            zonaLabel: null,
            principioId: "principle-1",
            principioTitulo: "Defensa organizada",
            gameMomentId: 1,
            gameMomentName: "Fase defensiva",
          },
        ],
      })
    );

    expect(result.current.form.objetivoGeneral).toBe("Texto histórico ya guardado");
  });

  it("loadSession() deja objetivoGeneral vacío cuando no hay targets ni texto guardado", () => {
    const { result } = renderHook(() =>
      useSessionForm({ teamId: "team-1", navigate, returnTo: "/coach/trainings" })
    );

    act(() =>
      result.current.loadSession({
        id: "sess-1",
        name: "Sesión 1",
        description: "",
        date: "2026-09-01",
        startTime: "10:00",
        endTime: null,
        location: null,
        sportEventId: null,
        microcicloId: null,
        objetivoGeneral: null,
        mapaCampoTexto: null,
        urlImage: null,
        blocks: [],
        targets: [],
      })
    );

    expect(result.current.form.objetivoGeneral).toBeNull();
  });
});
