import { Button } from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { MAX_SECOND_HALF_WINDOWS, MAX_TOTAL_WINDOWS } from "../../hooks/useMatchSimulation";
import styles from "./SubstitutionWindowTracker.module.css";

interface SubstitutionWindowTrackerProps {
  windowsTotal: number;
  windowsInSecondHalf: number;
  canOpenWindow: boolean;
  half: 1 | 2;
  prepareMode: boolean;
  onPrepare: () => void;
  onCancel: () => void;
  onCommit: () => void;
}

export default function SubstitutionWindowTracker({
  windowsTotal,
  windowsInSecondHalf,
  canOpenWindow,
  half,
  prepareMode,
  onPrepare,
  onCancel,
  onCommit,
}: SubstitutionWindowTrackerProps) {
  const totalDots = Array.from({ length: MAX_TOTAL_WINDOWS });
  const halfDots = Array.from({ length: MAX_SECOND_HALF_WINDOWS });

  return (
    <div className={styles.root}>
      {/* Total windows */}
      <div className={styles.counter}>
        <span className={styles.counterLabel}>Ventanas</span>
        <div className={styles.dots}>
          {totalDots.map((_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${i < windowsTotal ? styles.dotUsed : styles.dotFree}`}
            />
          ))}
        </div>
        <span className={styles.counterValue}>
          {windowsTotal}/{MAX_TOTAL_WINDOWS}
        </span>
      </div>

      {/* 2nd-half sub-counter */}
      {half === 2 && (
        <div className={styles.counter}>
          <span className={styles.counterLabel}>2ª parte</span>
          <div className={styles.dots}>
            {halfDots.map((_, i) => (
              <span
                key={i}
                className={`${styles.dot} ${
                  i < windowsInSecondHalf ? styles.dotUsed : styles.dotFree
                }`}
              />
            ))}
          </div>
          <span className={styles.counterValue}>
            {windowsInSecondHalf}/{MAX_SECOND_HALF_WINDOWS}
          </span>
        </div>
      )}

      {/* Action buttons */}
      {prepareMode ? (
        <div className={styles.prepareActions}>
          <Button
            variant="contained"
            size="small"
            color="success"
            startIcon={<CheckIcon />}
            onClick={onCommit}
            sx={{ fontSize: "0.72rem" }}
          >
            Confirmar cambio
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<CloseIcon />}
            onClick={onCancel}
            sx={{ fontSize: "0.72rem" }}
          >
            Cancelar
          </Button>
        </div>
      ) : (
        <Button
          variant="outlined"
          size="small"
          startIcon={<SwapHorizIcon />}
          disabled={!canOpenWindow}
          onClick={onPrepare}
          sx={{ fontSize: "0.72rem", whiteSpace: "nowrap" }}
        >
          Preparar cambio
        </Button>
      )}
    </div>
  );
}
