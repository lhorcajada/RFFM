import { IconButton, Tooltip } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import PsychologyIcon from "@mui/icons-material/Psychology";
import { client } from "../../../../../core/api/client";
import type { Exercise } from "../../../types/training";
import styles from "./ExerciseCromo.module.css";

const API_BASE = (client.defaults.baseURL ?? "/").replace(/\/$/, "");

function mediaUrl(urlImage: string): string {
  // If already absolute, use as-is (Supabase URLs start with https://)
  if (urlImage.startsWith("http://") || urlImage.startsWith("https://")) return urlImage;
  return `${API_BASE}/api/local-storage/${urlImage}`;
}

const TYPE_LABELS: Record<string, string> = {
  Physical: "Físico",
  Technical: "Técnico",
  Tactical: "Táctico",
};

const SECTION_LABELS: Record<string, string> = {
  Calentamiento: "Calentamiento",
  Principal: "Principal",
  VueltaALaCalma: "Vuelta calma",
};

function TypeIcon({ type }: { type: string }) {
  if (type === "Physical") return <FitnessCenterIcon sx={{ fontSize: 14 }} />;
  if (type === "Technical") return <SportsSoccerIcon sx={{ fontSize: 14 }} />;
  if (type === "Tactical") return <PsychologyIcon sx={{ fontSize: 14 }} />;
  return null;
}

type Props = {
  exercise: Exercise;
  onEdit: () => void;
  onDelete: () => void;
};

export default function ExerciseCromo({ exercise, onEdit, onDelete }: Props) {
  return (
    <div className={`${styles.card} ${styles[`type_${exercise.type}`] ?? ""}`}>
      {/* Photo area */}
      <div className={styles.photoArea}>
        {exercise.urlImage ? (
          <img
            src={mediaUrl(exercise.urlImage)}
            alt={exercise.name}
            className={styles.photo}
          />
        ) : (
          <div className={styles.photoFallback}>
            <div className={styles.fallbackIconWrap}>
              <TypeIcon type={exercise.type} />
            </div>
          </div>
        )}
        <div className={styles.photoGradient} />

        {/* Type badge bottom-left over gradient */}
        <div className={`${styles.typeBadge} ${styles[`typeBadge_${exercise.type}`] ?? ""}`}>
          <TypeIcon type={exercise.type} />
          <span>{TYPE_LABELS[exercise.type] ?? exercise.type}</span>
        </div>
      </div>

      {/* Body */}
      <div className={styles.body}>
        <div className={styles.exerciseName} title={exercise.name}>
          {exercise.name}
        </div>

        <div className={styles.metaRow}>
          <span className={`${styles.sectionPill} ${styles[`sectionPill_${exercise.section}`] ?? ""}`}>
            {SECTION_LABELS[exercise.section] ?? exercise.section}
          </span>
          {exercise.subSubPrincipleName && (
            <span className={styles.sspPill}>{exercise.subSubPrincipleName}</span>
          )}
        </div>

        {/* Stats row */}
        <div className={styles.statsRow}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{exercise.durationTotal}</span>
            <span className={styles.statLabel}>min</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{exercise.playersNumber}</span>
            <span className={styles.statLabel}>jug</span>
          </div>
          {exercise.goalPeekersNumber > 0 && (
            <div className={styles.statItem}>
              <span className={styles.statValue}>{exercise.goalPeekersNumber}</span>
              <span className={styles.statLabel}>port</span>
            </div>
          )}
        </div>
      </div>

      {/* Action footer */}
      <div className={styles.actionFooter}>
        <Tooltip title="Editar">
          <IconButton
            size="small"
            className={styles.actionBtn}
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <EditIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Eliminar">
          <IconButton
            size="small"
            className={`${styles.actionBtn} ${styles.deleteBtn}`}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <DeleteOutlineIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
}
