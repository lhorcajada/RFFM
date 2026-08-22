import { useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import trainingService from "../../../../services/trainingService";
import type { CreateSessionRequest, TrainingSessionDetail, UpdateSessionRequest } from "../../../../types/training";

interface UseSessionFormParams {
  teamId: string;
  navigate: NavigateFunction;
  returnTo: string;
  microcicloId?: string | null;
}

function emptySession(teamId: string, microcicloId?: string | null): CreateSessionRequest {
  return {
    teamId,
    name: "",
    description: "",
    date: "",
    startTime: "10:00",
    endTime: null,
    location: null,
    sportEventId: null,
    microcicloId: microcicloId ?? null,
    objetivoGeneral: null,
    mapaCampoTexto: null,
    blocks: [],
  };
}

export function useSessionForm({ teamId, navigate, returnTo, microcicloId }: UseSessionFormParams) {
  const [form, setForm] = useState<CreateSessionRequest>(() => emptySession(teamId, microcicloId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);

  const setField = (field: keyof CreateSessionRequest, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const loadSession = (session: TrainingSessionDetail) => {
    setForm({
      teamId,
      name: session.name,
      description: session.description,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime ?? null,
      location: session.location ?? null,
      sportEventId: session.sportEventId ?? null,
      microcicloId: session.microcicloId ?? null,
      objetivoGeneral: session.objetivoGeneral ?? null,
      mapaCampoTexto: session.mapaCampoTexto ?? null,
      blocks: session.blocks.map((b) => ({
        order: b.order,
        nombre: b.nombre,
        comoConectaConAnterior: b.comoConectaConAnterior,
        rotacionEntreEjercicios: b.rotacionEntreEjercicios ?? null,
        exercises: b.exercises.map((e) => ({ exerciseId: e.exerciseId, position: e.position })),
      })),
    });
    setSavedSessionId(session.id);
  };

  const handleCancel = () => navigate(returnTo, { replace: true });

  const validate = (): string | null => {
    if (!form.name.trim()) return "El nombre es obligatorio.";
    if (!form.date) return "La fecha es obligatoria.";
    if (form.blocks.length === 0) return "Una sesión debe tener al menos un bloque.";
    const blockWithoutConnection = form.blocks.find((b) => !b.comoConectaConAnterior.trim());
    if (blockWithoutConnection)
      return "Todo bloque debe indicar cómo conecta con el anterior, incluso el primero.";
    const blockWithoutExercises = form.blocks.find((b) => b.exercises.length === 0);
    if (blockWithoutExercises) return "Un bloque debe tener al menos un ejercicio.";
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (savedSessionId) {
        const { teamId: _t, ...update }: CreateSessionRequest = form;
        await trainingService.updateSession(savedSessionId, update as UpdateSessionRequest);
      } else {
        const created = await trainingService.createSession(form);
        setSavedSessionId(created.id);
      }
    } catch {
      setError("Error al guardar la sesión.");
    } finally {
      setSaving(false);
    }
  };

  return {
    form,
    setField,
    saving,
    error,
    savedSessionId,
    loadSession,
    handleCancel,
    handleSave,
  };
}

export type SessionFormState = ReturnType<typeof useSessionForm>;
