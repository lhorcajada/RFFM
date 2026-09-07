import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import styles from "./DragOverlayPreview.module.css";

interface DragOverlayPreviewProps {
  /** Breadcrumb segments (e.g. from `describeDragPayload`) — rendered as separate, wrapping
   * text so the full hierarchy stays legible while dragging, not just a bare role/count. */
  segments: string[];
}

/** The content-board's DragOverlay content — a floating breadcrumb preview of what's being
 * dragged (design.md F4 of season-plan-content-board). */
export default function DragOverlayPreview({ segments }: DragOverlayPreviewProps) {
  if (segments.length === 0) return null;

  return (
    <div className={styles.overlay}>
      {segments.map((segment, index) => (
        <span
          key={`${segment}-${index}`}
          className={index === segments.length - 1 ? `${styles.segment} ${styles.segmentLast}` : styles.segment}
        >
          {index > 0 && <ChevronRightIcon className={styles.separator} />}
          {segment}
        </span>
      ))}
    </div>
  );
}
