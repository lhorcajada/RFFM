import React from "react";
import { Box } from "@mui/material";
import styles from "../NewExercisePage.module.css";

interface Props {
  id: string;
  locked?: boolean;
  onLock?: (id: string) => void;
  onManualResize?: (id: string) => void;
  onRotate?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onRemove?: (id: string) => void;
  onScale?: (id: string, factor: number) => void;
  renderResizeHandles?: React.ReactNode;
  renderExtras?: React.ReactNode;
}

export default function PlacedObjectControls({
  id,
  locked,
  onLock,
  onManualResize,
  onRotate,
  onDuplicate,
  onRemove,
  onScale,
  renderResizeHandles,
  renderExtras,
}: Props) {
  return (
    <Box className={styles.spaceScaleControls} onMouseDown={(e) => e.stopPropagation()}>
      {renderResizeHandles}
      {renderExtras}

      {onLock && (
        <button
          type="button"
          className={styles.spaceScaleBtn}
          onClick={(e) => { e.stopPropagation(); onLock(id); }}
          aria-label={locked ? "Desbloquear" : "Bloquear"}
          title={locked ? "Desbloquear" : "Bloquear"}
        >
          {locked ? "🔓" : "🔒"}
        </button>
      )}

      {onManualResize && (
        <button
          type="button"
          className={styles.spaceScaleBtn}
          onClick={(e) => { e.stopPropagation(); onManualResize(id); }}
          aria-label="Redimension manual"
          title="Introducir tamano manual"
        >
          M
        </button>
      )}

      {onRotate && (
        <button
          type="button"
          className={styles.spaceScaleBtn}
          onClick={(e) => { e.stopPropagation(); onRotate(id); }}
          aria-label="Girar"
          title="Girar"
        >
          ↻
        </button>
      )}

      {onDuplicate && (
        <button
          type="button"
          className={styles.spaceScaleBtn}
          onClick={(e) => { e.stopPropagation(); onDuplicate(id); }}
          aria-label="Duplicar"
          title="Duplicar objeto"
        >
          ⧉
        </button>
      )}

      { /* manual scale via resize handles; +/− buttons removed */ }

      {onRemove && (
        <button
          type="button"
          className={styles.spaceScaleBtn}
          onClick={(e) => { e.stopPropagation(); onRemove(id); }}
          aria-label="Eliminar"
          title="Eliminar"
        >
          ✕
        </button>
      )}
    </Box>
  );
}
