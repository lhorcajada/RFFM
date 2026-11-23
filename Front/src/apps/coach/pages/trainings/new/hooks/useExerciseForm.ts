import { useEffect, useRef, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import { client } from "../../../../../../core/api/client";
import trainingService from "../../../../services/trainingService";
import type {
  CreateExerciseRequest,
  Exercise,
  ExerciseLevelRow,
  ExerciseTipo,
  UpdateExerciseRequest,
} from "../../../../types/training";
import { emptyExercise } from "../constants";
import { cleanSheetFields, exerciseToRequest } from "../exerciseRequest";
import { sheetContentFromForm } from "../../exerciseSheet";
import { describeOverflow, measureSheetFit, type SheetFit } from "../../sheetMeasure";

interface UseExerciseFormParams {
  clubId: string;
  navigate: NavigateFunction;
  returnTo: string;
  returnState?: unknown;
  getBoardStateJson?: () => string;
}

export function useExerciseForm({ clubId, navigate, returnTo, returnState, getBoardStateJson }: UseExerciseFormParams) {
  const [form, setForm] = useState<CreateExerciseRequest>({ ...emptyExercise, clubId });
  const [saving, setSaving] = useState(false);
  const [sheetFit, setSheetFit] = useState<SheetFit>({ fits: true, overflowPx: 0, overflowingBlocks: [] });
  const [drawingLevelCleared, setDrawingLevelCleared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [savedExerciseId, setSavedExerciseId] = useState<string | null>(null);
  const [createdExerciseId, setCreatedExerciseId] = useState<string | null>(null);

  const applyExercise = async (exercise: Exercise, asCopy: boolean) => {
    setForm(exerciseToRequest(exercise, clubId));
    setDrawingLevelCleared(false);

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

  const setNiveles = (nivelesColumnas: string[], niveles: ExerciseLevelRow[]) =>
    setForm((prev) => ({ ...prev, nivelesColumnas, niveles }));

  /** Marks the level the drawing shows. `cleared` flags that the marked row was deleted, so the
   * form warns until the coach marks another one (E5). */
  const setNivelDibujo = (nivelDibujo: number | null, cleared = false) => {
    setForm((prev) => ({ ...prev, nivelDibujo }));
    setDrawingLevelCleared(cleared || (nivelDibujo === null && drawingLevelCleared));
  };

  // The sheet is measured as the coach edits, so the form can warn at once and block saving while
  // the content does not fit one page (E12). Opening a migrated exercise runs the same check.
  useEffect(() => {
    setSheetFit(measureSheetFit(sheetContentFromForm(form)));
  }, [
    form.espacio,
    form.turnoMinutos,
    form.nivelDibujo,
    form.descripcion,
    form.reglas,
    form.puntos,
    form.rotaciones,
    form.montaje,
    form.nivelesColumnas,
    form.niveles,
  ]);

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

  // The previous screen (e.g. the session editor) uses the id to attach the exercise it asked for.
  const handleCancel = () =>
    navigate(returnTo, {
      replace: true,
      state: createdExerciseId
        ? { ...(returnState as Record<string, unknown> | undefined), createdExerciseId }
        : returnState,
    });

  /** Mirrors the backend's invariants client-side so the coach gets an inline error instead
   * of a 400 round-trip for the common cases (design.md Frontend §4). Returns the first
   * validation error message, or null when the form is valid. */
  const validate = (): string | null => {
    if (!form.name.trim()) return "El nombre es obligatorio.";
    if (!form.objetivo.trim()) return "El objetivo es obligatorio.";
    if (form.niveles.length < 2 || form.niveles.length > 5) return "Los niveles deben tener entre 2 y 5 filas.";
    const fit = measureSheetFit(sheetContentFromForm(form));
    if (!fit.fits) return `${describeOverflow(fit)} Acórtalo para poder guardar.`;
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
      const cleanForm = cleanSheetFields(form);

      if (exerciseId) {
        const { clubId: _c, ...update }: CreateExerciseRequest = cleanForm;
        await trainingService.updateExercise(exerciseId, {
          ...(update as UpdateExerciseRequest),
          boardStateJson,
        });
      } else {
        const created = await trainingService.createExercise({
          ...cleanForm,
          boardStateJson,
        });
        setSavedExerciseId(created.id);
        setCreatedExerciseId(created.id);

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
    setNiveles,
    setNivelDibujo,
    drawingLevelCleared,
    sheetFit,
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
