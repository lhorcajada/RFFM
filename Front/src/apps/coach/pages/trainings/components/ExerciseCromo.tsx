import { useRef } from "react";
import { IconButton, Tooltip } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import PsychologyIcon from "@mui/icons-material/Psychology";
import { Chip } from "@mui/material";
import { client } from "../../../../../core/api/client";
import type { Exercise } from "../../../types/training";
import TacticalBoardSnapshotPreview, {
  hasBoardObjects,
  tryParseBoardSnapshot,
} from "../../../components/TacticalBoardSnapshotPreview";
import boardPreviewCss from "../../../components/TacticalBoardSnapshotPreview.module.css?inline";
import { TIPO_LABELS } from "../exerciseTypeLabels";
import styles from "./ExerciseCromo.module.css";

const API_BASE = (client.defaults.baseURL ?? "/").replace(/\/$/, "");

function mediaUrl(urlImage: string): string {
  // If already absolute, use as-is (Supabase URLs start with https://)
  if (urlImage.startsWith("http://") || urlImage.startsWith("https://")) return urlImage;
  return `${API_BASE}/api/local-storage/${urlImage}`;
}

type Props = {
  exercise: Exercise;
  onEdit: () => void;
  onDuplicate: () => void;
  /** When the exercise has a tactical board drawing and no uploaded image, called with a
   * self-contained HTML fragment (the board preview's own `outerHTML` plus its CSS module
   * stylesheet) so the print sheet can embed it and let the browser render it natively —
   * omitted otherwise. */
  onPrint: (boardDrawingHtml?: string) => void;
  onDelete: () => void;
  /** Team whose roster resolves dorsal/alias for the tactical board preview. */
  teamId?: string;
};

export default function ExerciseCromo({ exercise, onEdit, onDuplicate, onPrint, onDelete, teamId }: Props) {
  const boardSnapshot = tryParseBoardSnapshot(exercise.boardStateJson);
  const showSnapshot = !exercise.urlImage && hasBoardObjects(boardSnapshot);
  const boardPreviewRef = useRef<HTMLDivElement>(null);

  const hasModelChips = exercise.modelRelations.length > 0;

  const handlePrint = () => {
    if (showSnapshot && boardPreviewRef.current) {
      onPrint(`<style>${boardPreviewCss}</style>${boardPreviewRef.current.outerHTML}`);
      return;
    }
    onPrint();
  };

  return (
    <div className={`${styles.card} ${styles[`tipo_${exercise.tipo}`] ?? ""}`}>
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
            // `.board` (inside TacticalBoardSnapshotPreview) needs a definite-height ancestor
            // to resolve its own `height: 100%` — this ref wrapper must pass photoArea's
            // (aspect-ratio-derived) height through explicitly, or `.board` collapses to 0.
            <div ref={boardPreviewRef} style={{ width: "100%", height: "100%" }}>
              <TacticalBoardSnapshotPreview snapshot={boardSnapshot} teamId={teamId} />
            </div>
          ) : (
            <div className={styles.photoFallback}>
              <div className={styles.fallbackIconWrap}>
                <PsychologyIcon />
              </div>
            </div>
          )}
          <div className={styles.photoGradient} />

          {/* Tipo badge in the card header, over the photo */}
          <div className={styles.tipoBadge} data-testid="tipo-badge">
            <span className={`${styles.tipoBadgeChip} ${styles[`tipoBadgeChip_${exercise.tipo}`] ?? ""}`}>
              {TIPO_LABELS[exercise.tipo] ?? exercise.tipo}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className={styles.body}>
          <div className={styles.exerciseName} title={exercise.name}>
            {exercise.name}
          </div>

          {exercise.isAssociatedToGameModel && (
            <div className={styles.tagsRow} data-testid="tags-row">
              <Chip label="Asociado al modelo" size="small" className={styles.associatedChip} />
            </div>
          )}

          {/* Model relation chips — one per ModelRelation (FOCO vs INTEGRADO) + nested items + Habilidades */}
          {hasModelChips && (
            <div className={styles.modelChipsRow} data-testid="model-chips-row">
              {exercise.modelRelations.map((relation) => (
                <Chip
                  key={relation.id}
                  label={`${relation.subprincipioNumero ?? ""} · ${relation.subprincipioTitulo ?? ""}`}
                  size="small"
                  className={relation.isFoco ? styles.modelLinkChipFoco : styles.modelLinkChipIntegrado}
                />
              ))}
              {exercise.modelRelations.flatMap((relation) =>
                relation.items.map((item) => (
                  <Chip
                    key={item.id}
                    label={`${item.subSubPrincipioNumero ?? ""} · ${item.subSubPrincipioRol ?? ""}`}
                    size="small"
                    className={item.isFoco ? styles.modelLinkChipFoco : styles.modelLinkChipIntegrado}
                  />
                ))
              )}
              {exercise.modelRelations.flatMap((relation) =>
                relation.habilidadesImprescindibles.map((h) => (
                  <Chip key={`${relation.id}-${h}`} label={h} size="small" className={styles.habilidadChip} />
                ))
              )}
            </div>
          )}

          {/* Stats row */}
          <div className={styles.statsRow}>
            {typeof exercise.durationMinutes === "number" && (
              <div className={styles.statItem}>
                <span className={styles.statValue}>{exercise.durationMinutes}</span>
                <span className={styles.statLabel}>min</span>
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
              onClick={(e) => { e.stopPropagation(); handlePrint(); }}
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
