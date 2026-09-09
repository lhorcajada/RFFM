import type { ReactNode } from "react";
import { Tooltip } from "@mui/material";
import { computeEf, fatigueTier, formTier } from "../../utils/playerFormMetrics";
import styles from "./PlayerFormBars.module.css";

type Props = {
  /** Rodaje (0-100). `null`/`undefined` → Ef y R se muestran sin dato ("—"). */
  readiness: number | null | undefined;
  /** Cansancio (0-100). `null`/`undefined` junto con `readiness` nulo → no se renderiza nada. */
  fatigue: number | null | undefined;
  /**
   * `compact`: 3 barritas verticales pequeñas lado a lado, letra siempre visible
   * (jugadores de campo, espacio muy reducido).
   * `full`: jerarquía padre-hijo, Ef destacado arriba, Rodaje/Cansancio indentados
   * debajo con etiqueta de texto completa (tarjetas de banquillo/ficha de jugador).
   */
  variant?: "compact" | "full";
  className?: string;
  /** Contenido opcional de tooltip para el segmento de Rodaje (p.ej. desglose entreno/partidos). */
  readinessTooltip?: ReactNode;
};

function formatValue(value: number | null): string {
  return value == null ? "—" : `${Math.round(value)}%`;
}

function toneOf(kind: "ef" | "r" | "c", value: number | null): "high" | "mid" | "low" | "none" {
  if (value == null) return "none";
  return kind === "c" ? fatigueTier(value) : formTier(value);
}

export default function PlayerFormBars({
  readiness,
  fatigue,
  variant = "compact",
  className,
  readinessTooltip,
}: Props) {
  if (readiness == null && fatigue == null) return null;

  const fatigueValue = fatigue ?? null;
  const efValue = fatigueValue == null ? null : computeEf(readiness ?? null, fatigueValue);

  const efTone = toneOf("ef", efValue);
  const rTone = toneOf("r", readiness ?? null);
  const cTone = toneOf("c", fatigueValue);

  if (variant === "full") {
    return (
      <div className={`${styles.full} ${className ?? ""}`}>
        <div className={styles.fullEfRow}>
          <span className={styles.fullEfLabel}>Ef</span>
          <div className={styles.fullTrack}>
            <div
              className={styles.fullFill}
              data-tone={efTone}
              style={{ width: `${efValue ?? 0}%` }}
            />
          </div>
          <span className={styles.fullEfValue} data-testid="player-form-bar-ef" data-tone={efTone}>
            {formatValue(efValue)}
          </span>
        </div>
        <div className={styles.fullChildren}>
          <RowFull
            testId="player-form-bar-r"
            label="Rodaje"
            value={readiness ?? null}
            tone={rTone}
            tooltip={readinessTooltip}
          />
          <RowFull testId="player-form-bar-c" label="Cansancio" value={fatigueValue} tone={cTone} />
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.compact} ${className ?? ""}`}>
      <CompactBar testId="player-form-bar-ef" letter="Ef" value={efValue} tone={efTone} />
      <CompactBar testId="player-form-bar-r" letter="R" value={readiness ?? null} tone={rTone} />
      <CompactBar testId="player-form-bar-c" letter="C" value={fatigueValue} tone={cTone} />
    </div>
  );
}

type CompactBarProps = {
  testId: string;
  letter: string;
  value: number | null;
  tone: "high" | "mid" | "low" | "none";
};

function CompactBar({ testId, letter, value, tone }: CompactBarProps) {
  return (
    <div className={styles.compactBar} data-testid={testId} data-tone={tone}>
      <span className={styles.compactLetter}>{letter}</span>
      <div className={styles.compactTrack}>
        <div className={styles.compactFill} data-tone={tone} style={{ width: `${value ?? 0}%` }} />
      </div>
      <span className={styles.compactValue}>{formatValue(value)}</span>
    </div>
  );
}

type RowFullProps = {
  testId: string;
  label: string;
  value: number | null;
  tone: "high" | "mid" | "low" | "none";
  tooltip?: ReactNode;
};

function RowFull({ testId, label, value, tone, tooltip }: RowFullProps) {
  const row = (
    <div className={styles.childRow} data-testid={testId} data-tone={tone}>
      <span className={styles.childLabel}>{label}</span>
      <div className={styles.childTrack}>
        <div className={styles.childFill} data-tone={tone} style={{ width: `${value ?? 0}%` }} />
      </div>
      <span className={styles.childValue}>{formatValue(value)}</span>
    </div>
  );

  if (!tooltip) return row;

  return <Tooltip title={tooltip}>{row}</Tooltip>;
}
