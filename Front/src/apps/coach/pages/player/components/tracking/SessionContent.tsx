import { CircularProgress } from "@mui/material";
import type { Exercise, TrainingSessionDetail } from "../../../../types/training";
import SessionExerciseCard from "./SessionExerciseCard";
import styles from "./SessionContent.module.css";

function scheduleLine(detail: TrainingSessionDetail): string {
  const time = detail.startTime
    ? detail.startTime.slice(0, 5) + (detail.endTime ? ` – ${detail.endTime.slice(0, 5)}` : "")
    : "";
  return [time, detail.location, detail.sportEventName].filter(Boolean).join(" · ");
}

type Props = {
  detail: TrainingSessionDetail | null;
  loading: boolean;
  exercisesById?: Map<string, Exercise>;
  teamId?: string;
};

/** Qué se hizo en la sesión (horario, objetivo y ejercicios), a la vista para refrescar la memoria al valorar. */
export default function SessionContent({ detail, loading, exercisesById = new Map(), teamId = "" }: Props) {
  if (loading) {
    return (
      <div className={styles.state}>
        <CircularProgress size={20} />
      </div>
    );
  }
  if (!detail) return null;

  const schedule = scheduleLine(detail);
  const blocks = [...detail.blocks]
    .sort((a, b) => a.order - b.order)
    .filter((block) => block.exercises.length > 0);

  return (
    <section className={styles.content} aria-label="Qué se hizo">
      <h4 className={styles.title}>Qué se hizo</h4>
      {schedule && <p className={styles.schedule}>{schedule}</p>}
      {detail.objetivoGeneral && <p className={styles.objective}>{detail.objetivoGeneral}</p>}
      {blocks.length === 0 ? (
        <p className={styles.empty}>La sesión no tiene ejercicios registrados</p>
      ) : (
        blocks.map((block) => (
          <div key={block.id} className={styles.block}>
            <h5 className={styles.blockName}>{block.nombre}</h5>
            {block.rotacionEntreEjercicios && (
              <p className={styles.rotation}>{`Rotación: ${block.rotacionEntreEjercicios}`}</p>
            )}
            <div className={styles.exercises}>
              {[...block.exercises]
                .sort((a, b) => a.position - b.position)
                .map((blockExercise) => (
                  <SessionExerciseCard
                    key={blockExercise.id}
                    blockExercise={blockExercise}
                    exercise={exercisesById.get(blockExercise.exerciseId)}
                    teamId={teamId}
                  />
                ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
