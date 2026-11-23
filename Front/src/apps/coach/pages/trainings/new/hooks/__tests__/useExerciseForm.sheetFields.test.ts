import { renderHook, act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useExerciseForm } from "../useExerciseForm";
import type { Exercise } from "../../../../../types/training";

vi.mock("../../../../../services/trainingService", () => ({
  default: {
    getExerciseById: vi.fn(),
    createExercise: vi.fn(),
    updateExercise: vi.fn(),
    uploadExerciseMedia: vi.fn(),
  },
}));

const navigate = vi.fn();

function renderForm() {
  return renderHook(() => useExerciseForm({ clubId: "club-1", navigate, returnTo: "/coach/trainings" }));
}

function fillRequiredFields(result: { current: ReturnType<typeof useExerciseForm> }) {
  act(() => result.current.setField("name", "Ejercicio completo"));
  act(() => result.current.setField("objetivo", "Objetivo claro"));
}

const baseExercise: Exercise = {
  id: "ex-1",
  name: "Ejercicio",
  tipo: "Global",
  objetivo: "Objetivo",
  nivelesColumnas: ["Palanca 1"],
  niveles: [
    { nivel: 1, valores: {} },
    { nivel: 2, valores: {} },
    { nivel: 3, valores: {} },
  ],
  logistica: "",
  descripcion: "",
};

describe("useExerciseForm — campos estructurados de la ficha", () => {
  beforeEach(() => vi.clearAllMocks());

  it("guarda sin logística ni descripción, que ya no son obligatorias", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (trainingService.createExercise as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "ex-new" });
    const { result } = renderForm();

    fillRequiredFields(result);
    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.error).toBeNull();
    expect(trainingService.createExercise).toHaveBeenCalled();
  });

  it("envía los campos de la ficha sin las líneas en blanco", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (trainingService.createExercise as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "ex-new" });
    const { result } = renderForm();

    fillRequiredFields(result);
    act(() => result.current.setField("espacio", "20x30 m"));
    act(() => result.current.setField("turnoMinutos", 3));
    act(() => result.current.setField("descripcion", "Se juega 4v2"));
    act(() => result.current.setField("reglas", ["Dos toques"]));
    act(() => result.current.setField("puntos", ["Gol = 1 punto", "  ", ""]));
    act(() => result.current.setField("rotaciones", ["", "Cada 3 minutos"]));
    act(() => result.current.setField("montaje", ["8 conos", " "]));
    await act(async () => {
      await result.current.handleSave();
    });

    const sent = (trainingService.createExercise as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sent.espacio).toBe("20x30 m");
    expect(sent.turnoMinutos).toBe(3);
    expect(sent.descripcion).toBe("Se juega 4v2");
    expect(sent.reglas).toEqual(["Dos toques"]);
    expect(sent.puntos).toEqual(["Gol = 1 punto"]);
    expect(sent.rotaciones).toEqual(["Cada 3 minutos"]);
    expect(sent.montaje).toEqual(["8 conos"]);
    expect(sent).not.toHaveProperty("jugadores");
    expect(sent).not.toHaveProperty("secuencia");
    expect(sent).not.toHaveProperty("queSeVe");
    expect(sent).not.toHaveProperty("porteros");
  });

  it("actualiza un ejercicio existente con los campos de la ficha", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (trainingService.updateExercise as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const { result } = renderForm();

    act(() => result.current.loadExercise({ ...baseExercise, puntos: ["Punto 1"], nivelDibujo: 2 }));
    await waitFor(() => expect(result.current.savedExerciseId).toBe("ex-1"));
    await act(async () => {
      await result.current.handleSave();
    });

    const [id, sent] = (trainingService.updateExercise as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(id).toBe("ex-1");
    expect(sent.puntos).toEqual(["Punto 1"]);
    expect(sent.nivelDibujo).toBe(2);
  });

  it("carga los campos de la ficha de un ejercicio existente", async () => {
    const { result } = renderForm();

    act(() =>
      result.current.loadExercise({
        ...baseExercise,
        espacio: "30x30 m",
        nivelDibujo: 3,
        descripcion: "Se juega 4v2",
        puntos: ["Punto 1"],
        rotaciones: ["Rotación 1"],
        montaje: ["Montaje 1"],
      }),
    );

    await waitFor(() => expect(result.current.form.espacio).toBe("30x30 m"));
    expect(result.current.form.nivelDibujo).toBe(3);
    expect(result.current.form.descripcion).toBe("Se juega 4v2");
    expect(result.current.form.puntos).toEqual(["Punto 1"]);
    expect(result.current.form.rotaciones).toEqual(["Rotación 1"]);
    expect(result.current.form.montaje).toEqual(["Montaje 1"]);
  });

  it("reemplaza los niveles al llamar a setNiveles", () => {
    const { result } = renderForm();

    act(() => result.current.setNiveles(["Toques"], [{ nivel: 1, valores: { Toques: "libres" } }, { nivel: 2, valores: {} }]));

    expect(result.current.form.nivelesColumnas).toEqual(["Toques"]);
    expect(result.current.form.niveles[0].valores).toEqual({ Toques: "libres" });
  });

  it("quita la marca y avisa cuando se borra la fila del nivel que muestra el dibujo", () => {
    const { result } = renderForm();

    act(() => result.current.setNivelDibujo(2));
    expect(result.current.drawingLevelCleared).toBe(false);

    act(() => result.current.setNivelDibujo(null, true));

    expect(result.current.form.nivelDibujo).toBeNull();
    expect(result.current.drawingLevelCleared).toBe(true);
  });

  it("deja de avisar cuando se marca otro nivel", () => {
    const { result } = renderForm();

    act(() => result.current.setNivelDibujo(null, true));
    act(() => result.current.setNivelDibujo(1));

    expect(result.current.drawingLevelCleared).toBe(false);
    expect(result.current.form.nivelDibujo).toBe(1);
  });

  describe("cuando el contenido no cabe en una hoja", () => {
    afterEach(() => vi.restoreAllMocks());

    function stubOverflow() {
      vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(() => 600);
      vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLElement) {
        return this.classList.contains("ficha-panel") ? 800 : 0;
      });
    }

    it("avisa con el motivo en cuanto se edita el contenido", async () => {
      stubOverflow();
      const { result } = renderForm();

      act(() => result.current.setField("reglas", ["Una regla"]));

      await waitFor(() => expect(result.current.sheetFit.fits).toBe(false));
      expect(result.current.sheetFit.overflowPx).toBe(200);
    });

    it("bloquea el guardado y explica el motivo", async () => {
      stubOverflow();
      const trainingService = (await import("../../../../../services/trainingService")).default;
      const { result } = renderForm();

      fillRequiredFields(result);
      await act(async () => {
        await result.current.handleSave();
      });

      expect(result.current.error).toMatch(/No cabe en una hoja A4/);
      expect(trainingService.createExercise).not.toHaveBeenCalled();
    });

    it("muestra el mismo aviso al abrir un ejercicio cuyo Qué se hace no cabe", async () => {
      stubOverflow();
      const { result } = renderForm();

      act(() =>
        result.current.loadExercise({
          ...baseExercise,
          descripcion: "Texto largo copiado literalmente de la descripción antigua",
        }),
      );

      await waitFor(() => expect(result.current.sheetFit.fits).toBe(false));
    });

    it("avisa cuando lo que no cabe está en Puntos, Rotaciones o Montaje", async () => {
      stubOverflow();
      const { result } = renderForm();

      act(() => result.current.setField("montaje", ["Un montaje largo"]));

      await waitFor(() => expect(result.current.sheetFit.fits).toBe(false));
    });
  });
});
