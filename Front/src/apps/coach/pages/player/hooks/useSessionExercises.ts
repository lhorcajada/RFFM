import { useEffect, useState } from "react";
import trainingService from "../../../services/trainingService";
import type { Exercise, TrainingSessionDetail } from "../../../types/training";

/** Datos completos de los ejercicios de una sesión (imagen o pizarra, niveles, relación con el modelo…). */
export function useSessionExercises(detail: TrainingSessionDetail | null) {
  const [exercisesById, setExercisesById] = useState<Map<string, Exercise>>(new Map());
  const [loading, setLoading] = useState(false);

  const exerciseIds = detail
    ? Array.from(new Set(detail.blocks.flatMap((block) => block.exercises.map((ex) => ex.exerciseId))))
    : [];
  const idsKey = exerciseIds.join(",");

  useEffect(() => {
    setExercisesById(new Map());
    if (!idsKey) return;
    let cancelled = false;
    setLoading(true);
    Promise.all(idsKey.split(",").map((id) => trainingService.getExerciseById(id)))
      .then((exercises) => {
        if (cancelled) return;
        setExercisesById(
          new Map(exercises.filter((e): e is Exercise => e !== null).map((e) => [e.id, e])),
        );
      })
      .catch(() => {
        if (!cancelled) setExercisesById(new Map());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  return { exercisesById, loading };
}
