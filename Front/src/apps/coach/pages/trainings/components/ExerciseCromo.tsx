import { IconButton, Tooltip } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import PsychologyIcon from "@mui/icons-material/Psychology";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import PsychologyAltIcon from "@mui/icons-material/PsychologyAlt";
import SelfImprovementIcon from "@mui/icons-material/SelfImprovement";
import { Chip } from "@mui/material";
import { client } from "../../../../../core/api/client";
import type { Exercise } from "../../../types/training";
import TacticalBoardSnapshotPreview, {
  hasBoardObjects,
  tryParseBoardSnapshot,
} from "../../../components/TacticalBoardSnapshotPreview";
import { TYPE_LABELS, SECTION_LABELS, METHODOLOGY_LABELS } from "../exerciseTypeLabels";
import styles from "./ExerciseCromo.module.css";

const API_BASE = (client.defaults.baseURL ?? "/").replace(/\/$/, "");

function mediaUrl(urlImage: string): string {
  // If already absolute, use as-is (Supabase URLs start with https://)
  if (urlImage.startsWith("http://") || urlImage.startsWith("https://")) return urlImage;
  return `${API_BASE}/api/local-storage/${urlImage}`;
}

function TypeIcon({ type }: { type: string }) {
  if (type === "Physical") return <FitnessCenterIcon sx={{ fontSize: 14 }} />;
  if (type === "Technical") return <SportsSoccerIcon sx={{ fontSize: 14 }} />;
  if (type === "Tactical") return <PsychologyIcon sx={{ fontSize: 14 }} />;
  if (type === "Game") return <SportsEsportsIcon sx={{ fontSize: 14 }} />;
  if (type === "Cognitive") return <PsychologyAltIcon sx={{ fontSize: 14 }} />;
  if (type === "Psychological") return <SelfImprovementIcon sx={{ fontSize: 14 }} />;
  return null;
}

type Props = {
  exercise: Exercise;
  onEdit: () => void;
  onDuplicate: () => void;
  onPrint: () => void;
  onDelete: () => void;
  /** Team whose roster resolves dorsal/alias for the tactical board preview. */
  teamId?: string;
};

export default function ExerciseCromo({ exercise, onEdit, onDuplicate, onPrint, onDelete, teamId }: Props) {
  const boardSnapshot = tryParseBoardSnapshot(exercise.boardStateJson);
  const showSnapshot = !exercise.urlImage && hasBoardObjects(boardSnapshot);

  const primaryType = exercise.types[0];
  const extraTypes = exercise.types.slice(1);

  return (
    <div className={`${styles.card} ${styles[`type_${primaryType}`] ?? ""}`}>
      {/* Section strip — vertical color accent with the section name */}
      <div
        className={`${styles.sectionStrip} ${styles[`sectionStrip_${exercise.section}`] ?? ""}`}
        title={SECTION_LABELS[exercise.section] ?? exercise.section}
        data-testid="section-strip"
      >
        <span className={styles.sectionStripLabel}>
          {SECTION_LABELS[exercise.section] ?? exercise.section}
        </span>
      </div>

      <div className={styles.cardMain}>
        {/* Photo area */}
        <div className={styles.photoArea}>
          {exercise.urlImage ? (
            <img
              src={mediaUrl(exercise.urlImage)}
              alt={exercise.name}
              className={styles.photo}
            />
          ) : showSnapshot && boardSnapshot ? (
            <TacticalBoardSnapshotPreview snapshot={boardSnapshot} teamId={teamId} />
          ) : (
            <div className={styles.photoFallback}>
              <div className={styles.fallbackIconWrap}>
                <TypeIcon type={primaryType} />
              </div>
            </div>
          )}
          <div className={styles.photoGradient} />

          {/* Methodology badge in the card header, over the photo */}
          <div className={styles.methodologyBadge} data-testid="methodology-badge">
            <span
              className={`${styles.methodologyBadgeChip} ${styles[`methodologyBadgeChip_${exercise.methodology}`] ?? ""}`}
            >
              {METHODOLOGY_LABELS[exercise.methodology] ?? exercise.methodology}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className={styles.body}>
          <div className={styles.exerciseName} title={exercise.name}>
            {exercise.name}
          </div>

          {/* Type tags + sub-principle, uniformly wrapped below the title */}
          <div className={styles.tagsRow} data-testid="tags-row">
            <div className={`${styles.typeBadge} ${styles[`typeBadge_${primaryType}`] ?? ""}`}>
              <TypeIcon type={primaryType} />
              <span>{TYPE_LABELS[primaryType] ?? primaryType}</span>
            </div>
            {extraTypes.map((t) => (
              <Chip
                key={t}
                label={TYPE_LABELS[t] ?? t}
                size="small"
                className={styles.extraTypeChip}
              />
            ))}
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
          <Tooltip title="Duplicar">
            <IconButton
              size="small"
              className={styles.actionBtn}
              onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            >
              <ContentCopyIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Imprimir PDF">
            <IconButton
              size="small"
              className={styles.actionBtn}
              onClick={(e) => { e.stopPropagation(); onPrint(); }}
            >
              <PrintOutlinedIcon sx={{ fontSize: 14 }} />
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
    </div>
  );
}
