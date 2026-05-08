import { useEffect, useMemo, useRef, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import gameModelService from "../../../../services/gameModelService";
import trainingService from "../../../../services/trainingService";
import type {
  CreateExerciseRequest,
  ExerciseCondition,
  ExerciseSection,
  ExerciseType,
} from "../../../../types/training";
import { emptyExercise } from "../constants";
import type { SkillOption } from "../types";

interface UseExerciseFormParams {
  clubId: string;
  subSubPrincipleId: string | null;
  navigate: NavigateFunction;
  returnTo: string;
}

export function useExerciseForm({
  clubId,
  subSubPrincipleId,
  navigate,
  returnTo,
}: UseExerciseFormParams) {
  const [form, setForm] = useState<CreateExerciseRequest>({
    ...emptyExercise,
    clubId,
    subSubPrincipleId,
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

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    setForm({ ...emptyExercise, clubId, subSubPrincipleId });
  }, [clubId, subSubPrincipleId]);

  useEffect(() => {
    if (!subSubPrincipleId) {
      setSkills([]);
      return;
    }
    setLoadingSkills(true);
    gameModelService
      .getSubSubPrincipleSkills(subSubPrincipleId)
      .then(setSkills)
      .catch(() => setSkills([]))
      .finally(() => setLoadingSkills(false));
  }, [subSubPrincipleId]);

  const setField = (field: keyof CreateExerciseRequest, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

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

    setSaving(true);
    setError(null);

    try {
      const created = await trainingService.createExercise(form);
      const exerciseId = created.id;

      if (pendingFile) {
        await trainingService.uploadExerciseMedia(exerciseId, pendingFile);
      }

      setSavedExerciseId(exerciseId);
      navigate(returnTo, { replace: true });
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

  const isPhysical = useMemo(() => form.type === "Physical", [form.type]);
  const isTechTac = useMemo(
    () => form.type === "Technical" || form.type === "Tactical",
    [form.type],
  );

  return {
    form,
    setField,
    toggleSkill,
    skills,
    loadingSkills,
    saving,
    error,
    pendingFile,
    previewUrl,
    fileInputRef,
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
