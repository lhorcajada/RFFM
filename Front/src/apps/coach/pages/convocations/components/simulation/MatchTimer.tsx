import { useState } from "react";
import { IconButton, Tooltip } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import ReplayIcon from "@mui/icons-material/Replay";
import FastForwardIcon from "@mui/icons-material/FastForward";
import styles from "./MatchTimer.module.css";

interface MatchTimerProps {
  currentMinute: number;
  currentSecond: number;
  isRunning: boolean;
  half: 1 | 2;
  isHalftime: boolean;
  halfDuration: number;
  showPhaseBadge?: boolean;
  showHalfControls?: boolean;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onAdvance: (minutes: number) => void;
  onJumpTo: (minute: number) => void;
  onHalftime: () => void;
  onSecondHalf: () => void;
}

function formatTime(minute: number, second: number): string {
  return `${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

export default function MatchTimer({
  currentMinute,
  currentSecond,
  isRunning,
  half,
  isHalftime,
  halfDuration,
  onStart,
  onStop,
  onReset,
  onAdvance,
  onJumpTo,
  onHalftime,
  onSecondHalf,
  showPhaseBadge = true,
  showHalfControls = true,
}: MatchTimerProps) {
  const [jumpValue, setJumpValue] = useState("");

  function handleJump() {
    const parsed = parseInt(jumpValue, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      onJumpTo(parsed);
      setJumpValue("");
    }
  }

  return (
    <div className={styles.root}>
      {/* Half badge */}
      {showPhaseBadge && (
        <span className={`${styles.halfBadge} ${half === 2 ? styles.secondHalf : ""} ${isHalftime ? styles.halftimeBadge : ""}`}>
          {isHalftime ? "DESC" : `${half}ª`}
        </span>
      )}

      {/* Clock display */}
      <span className={styles.clock}>{formatTime(currentMinute, currentSecond)}</span>

      {/* Play / Pause */}
      <Tooltip title={isRunning ? "Pausar" : "Iniciar"}>
        <IconButton
          size="small"
          className={styles.control}
          onClick={isRunning ? onStop : onStart}
        >
          {isRunning ? (
            <PauseIcon sx={{ fontSize: 22 }} />
          ) : (
            <PlayArrowIcon sx={{ fontSize: 22 }} />
          )}
        </IconButton>
      </Tooltip>

      {/* Reset */}
      <Tooltip title="Reiniciar al minuto 0">
        <IconButton size="small" className={styles.control} onClick={onReset}>
          <ReplayIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>

      {/* Fast-forward buttons */}
      <div className={styles.advanceGroup}>
        <Tooltip title="Avanzar 5 minutos">
          <button className={styles.advanceBtn} onClick={() => onAdvance(5)}>
            <FastForwardIcon sx={{ fontSize: 14 }} />
            <span>+5</span>
          </button>
        </Tooltip>
        <Tooltip title="Avanzar 10 minutos">
          <button className={styles.advanceBtn} onClick={() => onAdvance(10)}>
            <FastForwardIcon sx={{ fontSize: 14 }} />
            <span>+10</span>
          </button>
        </Tooltip>
      </div>

      {/* Halftime / 2nd half shortcuts */}
      {showHalfControls && (
        <div className={styles.advanceGroup}>
          <Tooltip title={`Ir al descanso (min ${halfDuration})`}>
            <button className={styles.halfBtn} onClick={onHalftime} disabled={half === 2}>
              Descanso
            </button>
          </Tooltip>
          <Tooltip title={`Iniciar 2ª parte (min ${halfDuration})`}>
            <button className={styles.halfBtn} onClick={onSecondHalf} disabled={half === 2}>
              2ª Parte
            </button>
          </Tooltip>
        </div>
      )}

      {/* Jump-to input */}
      <div className={styles.jumpGroup}>
        <input
          className={styles.jumpInput}
          type="number"
          min={0}
          max={120}
          placeholder="min"
          value={jumpValue}
          onChange={(e) => setJumpValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleJump()}
        />
        <button className={styles.jumpBtn} onClick={handleJump}>
          Ir
        </button>
      </div>
    </div>
  );
}
