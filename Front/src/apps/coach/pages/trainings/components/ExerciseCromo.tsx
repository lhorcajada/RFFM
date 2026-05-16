import { IconButton, Tooltip } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import PsychologyIcon from "@mui/icons-material/Psychology";
import { client } from "../../../../../core/api/client";
import type { Exercise } from "../../../types/training";
import type { TacticalBoardSnapshot } from "../new/types";
import { getDimensionsPercent, getShapeVertices } from "../new/helpers/spaceGeometry";
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

function tryParseBoardSnapshot(boardStateJson?: string | null): TacticalBoardSnapshot | null {
  if (!boardStateJson) return null;
  try {
    return JSON.parse(boardStateJson) as TacticalBoardSnapshot;
  } catch {
    return null;
  }
}

function hasBoardObjects(snapshot: TacticalBoardSnapshot | null): boolean {
  if (!snapshot) return false;
  return (
    Object.keys(snapshot.placedChapas ?? {}).length > 0 ||
    (snapshot.placedSpaces?.length ?? 0) > 0 ||
    (snapshot.placedMaterials?.length ?? 0) > 0 ||
    (snapshot.placedLines?.length ?? 0) > 0
  );
}

function SnapshotPreview({ snapshot }: { snapshot: TacticalBoardSnapshot }) {
  const chapas = Object.entries(snapshot.placedChapas ?? {});
  const spaces = snapshot.placedSpaces ?? [];
  const materials = snapshot.placedMaterials ?? [];
  const lines = snapshot.placedLines ?? [];

  return (
    <div className={styles.snapshotBoard} aria-label="Vista previa de la pizarra">
      <div className={styles.snapshotPitch}>
        <div className={styles.snapshotHalfLine} />
        <div className={styles.snapshotCenterCircle} />
        <div className={styles.snapshotPenaltyArea} />
        <div className={styles.snapshotGoalArea} />

        {lines.map((line) => (
          <span
            key={line.id}
            className={styles.snapshotLine}
            style={{
              left: `${line.x1}%`,
              top: `${line.y1}%`,
              width: `${Math.max(1, Math.hypot(line.x2 - line.x1, line.y2 - line.y1))}%`,
              transform: `rotate(${Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * (180 / Math.PI)}deg)`,
              backgroundColor: line.color,
            }}
          />
        ))}

        {spaces.map((space) => (
          <svg
            key={space.id}
            className={styles.snapshotSpace}
            style={{
              left: `${space.x}%`,
              top: `${space.y}%`,
              width: `${getDimensionsPercent(space.kind, space.scaleX, space.scaleY).width}%`,
              height: `${getDimensionsPercent(space.kind, space.scaleX, space.scaleY).height}%`,
              transform: `translate(-50%, -50%) rotate(${space.rotation}deg)`,
            }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {space.kind === "circle" ? (
              <circle
                cx="50"
                cy="50"
                r="50"
                fill={space.color ?? "#4d9de0"}
                fillOpacity="0.24"
                stroke={space.color ?? "#4d9de0"}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            ) : (
              <polygon
                points={getShapeVertices(space.kind).map((v) => `${v.x},${v.y}`).join(" ")}
                fill={space.color ?? "#4d9de0"}
                fillOpacity="0.24"
                stroke={space.color ?? "#4d9de0"}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        ))}

        {materials.map((material) => (
          <span
            key={material.id}
            className={styles.snapshotMaterial}
            style={{
              left: `${material.x}%`,
              top: `${material.y}%`,
              transform: `translate(-50%, -50%) rotate(${material.rotation}deg)`,
            }}
          />
        ))}

        {chapas.map(([id, chapa], index) => (
          <span
            key={id}
            className={styles.snapshotChapa}
            style={{
              left: `${chapa.x}%`,
              top: `${chapa.y}%`,
              width: `${Math.max(6, 5.8 * (chapa.scaleX ?? 1))}%`,
              transform: `translate(-50%, -50%) rotate(${chapa.rotation ?? 0}deg)`,
              background: chapa.anonymous
                ? `linear-gradient(160deg, hsl(${(index * 47) % 360} 75% 58%) 0%, hsl(${(index * 47) % 360} 75% 36%) 100%)`
                : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}

type Props = {
  exercise: Exercise;
  onEdit: () => void;
  onDuplicate: () => void;
  onPrint: () => void;
  onDelete: () => void;
};

export default function ExerciseCromo({ exercise, onEdit, onDuplicate, onPrint, onDelete }: Props) {
  const boardSnapshot = tryParseBoardSnapshot(exercise.boardStateJson);
  const showSnapshot = !exercise.urlImage && hasBoardObjects(boardSnapshot);

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
        ) : showSnapshot && boardSnapshot ? (
          <SnapshotPreview snapshot={boardSnapshot} />
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
  );
}
