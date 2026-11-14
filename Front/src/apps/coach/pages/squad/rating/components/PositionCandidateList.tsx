import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { IconButton } from "@mui/material";

import type { PositionFitCandidate } from "../../../../types/positionFit";
import type { TraitTrend } from "../../../../types/traitRating";

import styles from "./PositionCandidateList.module.css";

type Props = {
  label: string;
  /** Candidatos en el orden de trabajo actual. */
  candidates: PositionFitCandidate[];
  readOnly: boolean;
  onMove: (teamPlayerId: string, direction: "up" | "down") => void;
  onDrop: (activeId: string, overId: string) => void;
};

const TREND_SYMBOL: Record<TraitTrend, string> = { up: "↗", same: "=", down: "↘" };
const TREND_LABEL: Record<TraitTrend, string> = { up: "sube", same: "igual", down: "baja" };

export function formatFit(fit: number | null): string {
  return fit == null ? "Sin datos" : `Encaje ${fit.toFixed(1).replace(".", ",")}`;
}

type RowProps = {
  candidate: PositionFitCandidate;
  place: number;
  isFirst: boolean;
  isLast: boolean;
  readOnly: boolean;
  onMove: Props["onMove"];
};

function CandidateRow({ candidate, place, isFirst, isLast, readOnly, onMove }: RowProps) {
  const draggable = useDraggable({ id: candidate.teamPlayerId, disabled: readOnly });
  const droppable = useDroppable({ id: candidate.teamPlayerId });

  const style = draggable.transform ? { transform: CSS.Translate.toString(draggable.transform) } : undefined;

  return (
    <li
      ref={(node) => {
        draggable.setNodeRef(node);
        droppable.setNodeRef(node);
      }}
      style={style}
      className={`${styles.row} ${droppable.isOver ? styles.rowOver : ""} ${draggable.isDragging ? styles.rowDragging : ""}`}
    >
      <span className={styles.place} aria-hidden="true">{place}</span>
      <span className={styles.main}>
        <span className={styles.name} data-testid="candidate-name">{candidate.name}</span>
        <span className={styles.fit}>{formatFit(candidate.fit)}</span>
      </span>
      <span className={styles.trend} aria-label={`Tendencia: ${TREND_LABEL[candidate.trend]}`}>
        {TREND_SYMBOL[candidate.trend]}
      </span>
      <span className={styles.controls}>
        <IconButton
          size="small"
          aria-label={`Subir a ${candidate.name}`}
          disabled={readOnly || isFirst}
          onClick={() => onMove(candidate.teamPlayerId, "up")}
        >
          <ArrowUpwardIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          aria-label={`Bajar a ${candidate.name}`}
          disabled={readOnly || isLast}
          onClick={() => onMove(candidate.teamPlayerId, "down")}
        >
          <ArrowDownwardIcon fontSize="small" />
        </IconButton>
        {!readOnly && (
          <span
            className={styles.handle}
            ref={draggable.setActivatorNodeRef}
            {...draggable.listeners}
            aria-label={`Arrastrar a ${candidate.name}`}
            role="img"
          >
            <DragIndicatorIcon fontSize="small" />
          </span>
        )}
      </span>
    </li>
  );
}

export default function PositionCandidateList({ label, candidates, readOnly, onMove, onDrop }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) onDrop(String(active.id), String(over.id));
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <ul className={styles.list} aria-label={`Candidatos de ${label}`}>
        {candidates.map((candidate, index) => (
          <CandidateRow
            key={candidate.teamPlayerId}
            candidate={candidate}
            place={index + 1}
            isFirst={index === 0}
            isLast={index === candidates.length - 1}
            readOnly={readOnly}
            onMove={onMove}
          />
        ))}
      </ul>
    </DndContext>
  );
}
