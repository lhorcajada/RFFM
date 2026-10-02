import { CircularProgress } from "@mui/material";
import type { SessionBlockExercise, TrainingSessionDetail } from "../../../../types/training";
import styles from "./SessionContent.module.css";

function exerciseInfo(exercise: SessionBlockExercise): string {
  return [exercise.objetivo, exercise.durationMinutes ? `${exercise.durationMinutes}'` : null]
    .filter(Boolean)
    .join(" · ");
}

type Props = {
  detail: TrainingSessionDetail | null;
  loading: boolean;
};

/** Qué se hizo en la sesión (objetivo y ejercicios), a la vista para refrescar la memoria al valorar. */
export default function SessionContent({ detail, loading }: Props) {
  if (loading) {
    return (
      <div className={styles.state}>
        <CircularProgress size={20} />
      </div>
    );
  }
  if (!detail) return null;

  const blocks = [...detail.blocks]
    .sort((a, b) => a.order - b.order)
    .filter((block) => block.exercises.length > 0);

  return (
    <section className={styles.content} aria-label="Qué se hizo">
      <h4 className={styles.title}>Qué se hizo</h4>
      {detail.objetivoGeneral && <p className={styles.objective}>{detail.objetivoGeneral}</p>}
      {blocks.length === 0 ? (
        <p className={styles.empty}>La sesión no tiene ejercicios registrados</p>
      ) : (
        blocks.map((block) => (
          <div key={block.id} className={styles.block}>
            <h5 className={styles.blockName}>{block.nombre}</h5>
            <ul className={styles.exercises}>
              {[...block.exercises]
                .sort((a, b) => a.position - b.position)
                .map((exercise) => (
                  <li key={exercise.id} aria-label={exercise.name}>
                    <span className={styles.exerciseName}>{exercise.name}</span>
                    {exerciseInfo(exercise) && <span className={styles.exerciseInfo}>{exerciseInfo(exercise)}</span>}
                  </li>
                ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
