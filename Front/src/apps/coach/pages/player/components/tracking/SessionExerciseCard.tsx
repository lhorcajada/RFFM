import { useState } from "react";
import { Button, Chip } from "@mui/material";
import TacticalBoardSnapshotPreview, {
  hasBoardObjects,
  tryParseBoardSnapshot,
} from "../../../../components/TacticalBoardSnapshotPreview";
import { mediaUrl } from "../../../trainings/exercisePrint";
import { TIPO_LABELS } from "../../../trainings/exerciseTypeLabels";
import type { Exercise, SessionBlockExercise } from "../../../../types/training";
import styles from "./SessionExerciseCard.module.css";

type Props = {
  blockExercise: SessionBlockExercise;
  /** Ejercicio completo; sin él se muestran solo los datos del bloque y no hay detalle. */
  exercise?: Exercise;
  teamId: string;
};

/** Ejercicio de la sesión: imagen o pizarra, datos principales y detalle desplegable. */
export default function SessionExerciseCard({ blockExercise, exercise, teamId }: Props) {
  const [expanded, setExpanded] = useState(false);

  const name = exercise?.name ?? blockExercise.name ?? "Ejercicio";
  const tipo = exercise?.tipo ?? blockExercise.tipo;
  const objetivo = exercise?.objetivo ?? blockExercise.objetivo;
  const duration = exercise?.durationMinutes ?? blockExercise.durationMinutes;
  const urlImage = exercise?.urlImage ?? blockExercise.urlImage;
  const board = tryParseBoardSnapshot(exercise?.boardStateJson);
  const showBoard = !urlImage && hasBoardObjects(board);
  const niveles = [...(exercise?.niveles ?? [])].sort((a, b) => a.nivel - b.nivel);

  return (
    <article className={styles.card} aria-label={name}>
      {urlImage && <img className={styles.image} src={mediaUrl(urlImage)} alt={name} />}
      {showBoard && board && (
        <div className={styles.board}>
          <TacticalBoardSnapshotPreview snapshot={board} teamId={teamId} />
        </div>
      )}

      <div className={styles.body}>
        <div className={styles.header}>
          <span className={styles.name}>{name}</span>
          <div className={styles.meta}>
            {tipo && <Chip size="small" variant="outlined" label={TIPO_LABELS[tipo] ?? tipo} />}
            {typeof duration === "number" && <span className={styles.duration}>{`${duration}'`}</span>}
          </div>
        </div>
        {objetivo && <p className={styles.objetivo}>{objetivo}</p>}

        {exercise && (
          <>
            <Button
              size="small"
              className={styles.toggle}
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Ocultar detalle" : "Ver detalle"}
            </Button>

            {expanded && (
              <div className={styles.detail}>
                {exercise.descripcion && (
                  <div>
                    <h6 className={styles.sectionTitle}>Descripción</h6>
                    <p className={styles.text}>{exercise.descripcion}</p>
                  </div>
                )}
                {exercise.logistica && (
                  <div>
                    <h6 className={styles.sectionTitle}>Logística</h6>
                    <p className={styles.text}>{exercise.logistica}</p>
                  </div>
                )}
                {exercise.porteros && (
                  <div>
                    <h6 className={styles.sectionTitle}>Porteros</h6>
                    <p className={styles.text}>{exercise.porteros}</p>
                  </div>
                )}
                {niveles.length > 0 && (
                  <div>
                    <h6 className={styles.sectionTitle}>Niveles</h6>
                    <ul className={styles.niveles} aria-label="Niveles">
                      {niveles.map((row) => (
                        <li key={row.nivel}>
                          <span className={styles.nivel}>{`Nivel ${row.nivel}`}</span>
                          {exercise.nivelesColumnas.map((col) => `${col}: ${row.valores[col] ?? ""}`).join(" · ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {exercise.modelRelations.length > 0 && (
                  <section aria-label="Relación con el modelo">
                    <h6 className={styles.sectionTitle}>Relación con el modelo</h6>
                    {exercise.modelRelations.map((relation) => (
                      <div key={relation.id} className={styles.relation}>
                        <div className={styles.chips}>
                          <Chip
                            size="small"
                            color={relation.isFoco ? "primary" : "default"}
                            label={`${relation.subprincipioNumero ?? ""} · ${relation.subprincipioTitulo ?? ""}`}
                          />
                          {relation.items.map((item) => (
                            <Chip
                              key={item.id}
                              size="small"
                              variant="outlined"
                              label={`${item.subSubPrincipioNumero ?? ""} · ${item.subSubPrincipioRol ?? ""}`}
                            />
                          ))}
                        </div>
                        {relation.habilidadesImprescindibles.length > 0 && (
                          <div className={styles.chips}>
                            {relation.habilidadesImprescindibles.map((h) => (
                              <Chip key={h} size="small" color="success" variant="outlined" label={h} />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}
