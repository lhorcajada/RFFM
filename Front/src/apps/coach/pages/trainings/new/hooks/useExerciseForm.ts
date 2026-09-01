import { useEffect, useRef, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import { client } from "../../../../../../core/api/client";
import trainingService from "../../../../services/trainingService";
import type { CreateExerciseRequest, Exercise, ExerciseTipo, UpdateExerciseRequest } from "../../../../types/training";
import { emptyExercise } from "../constants";

interface UseExerciseFormParams {
  clubId: string;
  navigate: NavigateFunction;
  returnTo: string;
  getBoardStateJson?: () => string;
}

export function useExerciseForm({ clubId, navigate, returnTo, getBoardStateJson }: UseExerciseFormParams) {
  const [form, setForm] = useState<CreateExerciseRequest>({ ...emptyExercise, clubId });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [savedExerciseId, setSavedExerciseId] = useState<string | null>(null);

  const applyExercise = async (exercise: Exercise, asCopy: boolean) => {
    setForm({
      clubId,
      name: exercise.name,
      tipo: exercise.tipo,
      objetivo: exercise.objetivo,
      objetivoPorRol: exercise.objetivoPorRol ?? null,
      modelRelations: (exercise.modelRelations ?? []).map((r) => ({
        subprincipioId: r.subprincipioId,
        isFoco: r.isFoco,
        habilidadesImprescindibles: r.habilidadesImprescindibles ?? [],
        items: (r.items ?? []).map((it) => ({ subSubPrincipioId: it.subSubPrincipioId, isFoco: it.isFoco })),
      })),
      nivelesColumnas: exercise.nivelesColumnas ?? [],
      niveles: exercise.niveles ?? [],
      logistica: exercise.logistica,
      durationMinutes: exercise.durationMinutes ?? null,
      porteros: exercise.porteros ?? null,
      dibujo: exercise.dibujo ?? null,
      descripcion: exercise.descripcion,
      boardStateJson: exercise.boardStateJson ?? null,
    });

    setSavedExerciseId(asCopy ? null : exercise.id);
    setPendingFile(null);

    if (previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    if (exercise.urlImage) {
      const base = (client.defaults.baseURL ?? "/").replace(/\/$/, "");
      const preview = `${base}/api/local-storage/${exercise.urlImage}`;
      setPreviewUrl(preview);

      if (asCopy) {
        try {
          const response = await fetch(preview);
          if (response.ok) {
            const blob = await response.blob();
            const guessedName = exercise.urlImage.split("/").pop() ?? "media";
            const file = new File([blob], guessedName, { type: blob.type || "application/octet-stream" });
            setPendingFile(file);
          }
        } catch {
          setPendingFile(null);
        }
      }
    } else {
      setPreviewUrl(null);
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    setForm({ ...emptyExercise, clubId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  const loadExercise = (exercise: Exercise) => void applyExercise(exercise, false);
  const loadExerciseAsCopy = (exercise: Exercise) => void applyExercise(exercise, true);

  const setField = (field: keyof CreateExerciseRequest, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;

    if (previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveMedia = () => {
    if (previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPendingFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCancel = () => navigate(returnTo, { replace: true });

  /** Mirrors the backend's invariants client-side so the coach gets an inline error instead
   * of a 400 round-trip for the common cases (design.md Frontend §4). Returns the first
   * validation error message, or null when the form is valid. */
  const validate = (): string | null => {
    if (!form.name.trim()) return "El nombre es obligatorio.";
    if (!form.objetivo.trim()) return "El objetivo es obligatorio.";
    if (!form.logistica.trim()) return "La logística es obligatoria.";
    if (!form.descripcion.trim()) return "La descripción es obligatoria.";
    if (form.niveles.length < 2 || form.niveles.length > 5) return "Los niveles deben tener entre 2 y 5 filas.";
    const relationWithoutSubprincipio = form.modelRelations.find((r) => !r.subprincipioId);
    if (relationWithoutSubprincipio) return "Cada vínculo con el modelo requiere un Subprincipio.";
    return null;
  };

  const handleSave = async () => {
    if (!clubId) {
      setError("No se ha encontrado el club para crear el ejercicio.");
      return;
    }

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const boardStateJson = getBoardStateJson?.() ?? null;
      const exerciseId = savedExerciseId;

      if (exerciseId) {
        const { clubId: _c, ...update }: CreateExerciseRequest = form;
        await trainingService.updateExercise(exerciseId, {
          ...(update as UpdateExerciseRequest),
          boardStateJson,
        });
      } else {
        const created = await trainingService.createExercise({
          ...form,
          boardStateJson,
        });
        setSavedExerciseId(created.id);

        if (pendingFile) {
          await trainingService.uploadExerciseMedia(created.id, pendingFile);
        }
        window.dispatchEvent(
          new CustomEvent("rffm.show_snackbar", { detail: { message: "Ejercicio guardado", severity: "success" } }),
        );
        return;
      }

      if (pendingFile) {
        await trainingService.uploadExerciseMedia(exerciseId, pendingFile);
      }

      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", { detail: { message: "Ejercicio guardado", severity: "success" } }),
      );
    } catch {
      setError("Error al guardar el ejercicio.");
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", { detail: { message: "Error al guardar el ejercicio", severity: "error" } }),
      );
    } finally {
      setSaving(false);
    }
  };

  return {
    form,
    setField,
    saving,
    error,
    pendingFile,
    previewUrl,
    fileInputRef,
    loadExercise,
    loadExerciseAsCopy,
    savedExerciseId,
    handleFileChange,
    handleRemoveMedia,
    handleCancel,
    handleSave,
  };
}

export type ExerciseFormState = ReturnType<typeof useExerciseForm>;

// Re-export types consumed by the form panel
export type { ExerciseTipo };
