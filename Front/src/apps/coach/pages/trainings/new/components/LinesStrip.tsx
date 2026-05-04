import { Box, Typography } from "@mui/material";
import { LINE_COLORS, LINE_KIND_OPTIONS } from "../constants";
import type { TacticalBoardState } from "../hooks/useTacticalBoard";
import styles from "../NewExercisePage.module.css";

interface LinesStripProps {
  board: TacticalBoardState;
}

export default function LinesStrip({ board }: LinesStripProps) {
  const {
    activeLineKind,
    setActiveLineKind,
    activeLineColor,
    setActiveLineColor,
    placedLines,
    setPlacedLines,
  } = board;

  return (
    <Box className={styles.linesStrip}>
      <Box className={styles.linesStripKinds}>
        {LINE_KIND_OPTIONS.map((opt) => (
          <button
            key={opt.kind}
            type="button"
            className={`${styles.lineKindCard} ${activeLineKind === opt.kind ? styles.lineKindCardActive : ""}`}
            onClick={() => setActiveLineKind((prev) => (prev === opt.kind ? null : opt.kind))}
            title={opt.label}
          >
            <svg viewBox="0 0 40 24" className={styles.lineKindPreview} preserveAspectRatio="none">
              {(opt.kind === "straight" ||
                opt.kind === "dashed" ||
                opt.kind === "arrow" ||
                opt.kind === "arrow-dashed") && (
                <line
                  x1="4"
                  y1="12"
                  x2="36"
                  y2="12"
                  stroke={activeLineColor}
                  strokeWidth="2"
                  strokeDasharray={
                    opt.kind === "dashed" || opt.kind === "arrow-dashed" ? "5 3" : undefined
                  }
                  markerEnd={
                    opt.kind === "arrow" || opt.kind === "arrow-dashed"
                      ? "url(#prev-arrow)"
                      : undefined
                  }
                />
              )}
              {opt.kind === "curved" && (
                <path d="M 4 18 Q 20 2 36 18" stroke={activeLineColor} strokeWidth="2" fill="none" />
              )}
              {opt.kind === "free" && (
                <path
                  d="M 4 18 L 10 8 L 18 14 L 26 6 L 36 12"
                  stroke={activeLineColor}
                  strokeWidth="2"
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              <defs>
                <marker
                  id="prev-arrow"
                  markerWidth="5"
                  markerHeight="5"
                  refX="4"
                  refY="2.5"
                  orient="auto"
                >
                  <path d="M 0 0 L 5 2.5 L 0 5 Z" fill={activeLineColor} />
                </marker>
              </defs>
            </svg>
            <span className={styles.lineKindLabel}>{opt.label}</span>
          </button>
        ))}
      </Box>

      <Box className={styles.linesStripColors}>
        {LINE_COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`${styles.lineColorSwatch} ${activeLineColor === c.value ? styles.lineColorSwatchActive : ""}`}
            style={{ backgroundColor: c.value }}
            onClick={() => setActiveLineColor(c.value)}
            title={c.label}
            aria-label={c.label}
          />
        ))}
        {placedLines.length > 0 && (
          <button
            type="button"
            className={styles.linesDeleteAllBtn}
            onClick={() => setPlacedLines([])}
            title="Borrar todas las líneas"
          >
            ✕ Borrar todo
          </button>
        )}
      </Box>

      {activeLineKind && (
        <Typography className={styles.linesHint}>
          Haz clic y arrastra en el campo para dibujar. Abre Líneas sin tipo seleccionado para
          borrar haciendo clic.
        </Typography>
      )}
    </Box>
  );
}
