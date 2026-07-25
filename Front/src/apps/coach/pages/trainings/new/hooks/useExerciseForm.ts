import { useEffect, useMemo, useRef, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import { client } from "../../../../../../core/api/client";
import gameModelService from "../../../../services/gameModelService";
import trainingService from "../../../../services/trainingService";
import type {
  CreateExerciseRequest,
  Exercise,
  ExerciseCondition,
  ExerciseSection,
  UpdateExerciseRequest,
  ExerciseType,
} from "../../../../types/training";
import { emptyExercise } from "../constants";
import type { SkillOption } from "../types";

interface UseExerciseFormParams {
  clubId: string;
  subSubPrincipleId: string | null;
  subPrincipleId: string | null;
  navigate: NavigateFunction;
  returnTo: string;
  getBoardStateJson?: () => string;
}

export function useExerciseForm({
  clubId,
  subSubPrincipleId,
  subPrincipleId,
  navigate,
  returnTo,
  getBoardStateJson,
}: UseExerciseFormParams) {
  const [resolvedSubSubPrincipleId, setResolvedSubSubPrincipleId] = useState<string | null>(subSubPrincipleId);
  const [form, setForm] = useState<CreateExerciseRequest>({
    ...emptyExercise,
    clubId,
    subSubPrincipleId,
    subPrincipleId,
  });
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [conditions, setConditions] = useState<ExerciseCondition[]>([]);
  const [conditionInput, setConditionInput] = useState("");
  const [editingCondition, setEditingCondition] = useState<{
    id: string;
    text: string;
  } | null>(null);
  const [savingCondition, setSavingCondition] = useState(false);
  const [savedExerciseId, setSavedExerciseId] = useState<string | null>(null);

  const applyExercise = async (exercise: Exercise, asCopy: boolean) => {
    setResolvedSubSubPrincipleId(exercise.subSubPrincipleId ?? subSubPrincipleId ?? null);
    setForm({
      clubId,
      name: exercise.name,
      description: exercise.description,
      types: exercise.types,
      section: exercise.section,
      durationTotal: exercise.durationTotal,
      playersNumber: exercise.playersNumber,
      goalPeekersNumber: exercise.goalPeekersNumber,
      fieldSpace: exercise.fieldSpace,
      subSubPrincipleId: exercise.subSubPrincipleId ?? subSubPrincipleId ?? null,
      subPrincipleId: exercise.subPrincipleId ?? subPrincipleId ?? null,
      essentialSkillIds: exercise.skills.map((skill) => skill.essentialSkillId),
      boardStateJson: exercise.boardStateJson ?? null,
      touchesNumber: exercise.touchesNumber ?? 0,
      wildCards: exercise.wildCards ?? 0,
      series: exercise.series ?? 0,
      durationSeries: exercise.durationSeries ?? 0,
      restSeries: exercise.restSeries ?? 0,
    });

    setSavedExerciseId(asCopy ? null : exercise.id);
    setConditions(exercise.conditions ?? []);
    setConditionInput("");
    setEditingCondition(null);
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
    setResolvedSubSubPrincipleId(subSubPrincipleId);
    setForm({ ...emptyExercise, clubId, subSubPrincipleId, subPrincipleId });
  }, [clubId, subSubPrincipleId, subPrincipleId]);

  useEffect(() => {
    if (!resolvedSubSubPrincipleId) {
      setSkills([]);
      return;
    }
    setLoadingSkills(true);
    gameModelService
      .getSubSubPrincipleSkills(resolvedSubSubPrincipleId)
      .then(setSkills)
      .catch(() => setSkills([]))
      .finally(() => setLoadingSkills(false));
  }, [resolvedSubSubPrincipleId]);

  const loadExercise = (exercise: Exercise) => void applyExercise(exercise, false);
  const loadExerciseAsCopy = (exercise: Exercise) => void applyExercise(exercise, true);

  const setField = (field: keyof CreateExerciseRequest, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const setLevel = (kind: "subSubPrinciple" | "subPrinciple") => {
    setForm((prev) => ({
      ...prev,
      subSubPrincipleId: kind === "subSubPrinciple" ? (subSubPrincipleId ?? prev.subSubPrincipleId ?? null) : null,
      subPrincipleId: kind === "subPrinciple" ? (subPrincipleId ?? prev.subPrincipleId ?? null) : null,
      essentialSkillIds: kind === "subPrinciple" ? [] : prev.essentialSkillIds,
    }));
  };

  const toggleSkill = (skillId: string) => {
    setForm((prev) => {
      const ids = prev.essentialSkillIds.includes(skillId)
        ? prev.essentialSkillIds.filter((id) => id !== skillId)
        : [...prev.essentialSkillIds, skillId];
      return { ...prev, essentialSkillIds: ids };
    });
  };

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

  const handleSave = async () => {
    if (!clubId) {
      setError("No se ha encontrado el club para crear el ejercicio.");
      return;
    }
    if (!form.name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (form.types.length === 0) {
      setError("Selecciona al menos un tipo.");
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
          ...update,
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
        return;
      }

      if (pendingFile) {
        await trainingService.uploadExerciseMedia(exerciseId, pendingFile);
      }
    } catch {
      setError("Error al guardar el ejercicio.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddCondition = async () => {
    const text = conditionInput.trim();
    if (!text || !savedExerciseId) return;
    setSavingCondition(true);
    try {
      const added = await trainingService.createCondition(savedExerciseId, text);
      setConditions((prev) => [...prev, added]);
      setConditionInput("");
    } finally {
      setSavingCondition(false);
    }
  };

  const handleSaveEditCondition = async () => {
    if (!editingCondition) return;
    const text = editingCondition.text.trim();
    if (!text) return;
    setSavingCondition(true);
    try {
      const updated = await trainingService.updateCondition(editingCondition.id, text);
      setConditions((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditingCondition(null);
    } finally {
      setSavingCondition(false);
    }
  };

  const handleDeleteCondition = async (conditionId: string) => {
    setSavingCondition(true);
    try {
      await trainingService.deleteCondition(conditionId);
      setConditions((prev) => prev.filter((c) => c.id !== conditionId));
    } finally {
      setSavingCondition(false);
    }
  };

  const isPhysical = useMemo(() => form.types.includes("Physical"), [form.types]);
  const isTechTac = useMemo(
    () => form.types.includes("Technical") || form.types.includes("Tactical"),
    [form.types],
  );

  return {
    form,
    setField,
    setLevel,
    toggleSkill,
    skills,
    loadingSkills,
    saving,
    error,
    pendingFile,
    previewUrl,
    fileInputRef,
    loadExercise,
    loadExerciseAsCopy,
    conditions,
    conditionInput,
    setConditionInput,
    editingCondition,
    setEditingCondition,
    savingCondition,
    savedExerciseId,
    handleFileChange,
    handleRemoveMedia,
    handleCancel,
    handleSave,
    handleAddCondition,
    handleSaveEditCondition,
    handleDeleteCondition,
    isPhysical,
    isTechTac,
  };
}

export type ExerciseFormState = ReturnType<typeof useExerciseForm>;

// Re-export types consumed by the form panel
export type { ExerciseSection, ExerciseType };
