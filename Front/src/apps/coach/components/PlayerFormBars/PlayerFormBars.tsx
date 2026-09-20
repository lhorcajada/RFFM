import { IconButton } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { computeEf, fatigueTier, formTier } from "../../utils/playerFormMetrics";
import styles from "./PlayerFormBars.module.css";

type Props = {
  /** Rodaje (0-100). `null`/`undefined` → Ef y R se muestran sin dato ("—"). */
  readiness: number | null | undefined;
  /** Cansancio (0-100). `null`/`undefined` junto con `readiness` nulo → no se renderiza nada. */
  fatigue: number | null | undefined;
  /**
   * Estado de forma (0-100) calculado en backend. Cuando se pasa (incluso `null`, distinto de
   * `undefined`), sustituye al cálculo local `computeEf(readiness, fatigue)` como valor de "Ef".
   * Si no se pasa (`undefined`), se mantiene el cálculo local, para no romper a los consumidores
   * que todavía no tienen `formStatus` disponible (convocatorias, banquillo, plantilla…).
   */
  formStatus?: number | null;
  /**
   * `compact`: 3 barritas verticales pequeñas lado a lado, letra siempre visible
   * (jugadores de campo, espacio muy reducido).
   * `full`: jerarquía padre-hijo, Ef destacado arriba, Rodaje/Cansancio indentados
   * debajo con etiqueta de texto completa (tarjetas de banquillo/ficha de jugador).
   */
  variant?: "compact" | "full";
  className?: string;
  /**
   * Solo aplica a `variant="full"`. Cuando se pasa, la fila muestra un botón "¿Cómo se calcula?"
   * que invoca el handler (el consumidor abre el diálogo de explicación). Sin handler, la fila
   * se queda sin botón.
   */
  onReadinessInfo?: () => void;
  onFatigueInfo?: () => void;
  onFormStatusInfo?: () => void;
  /**
   * Solo aplica a `variant="compact"`. Por defecto ocupa un ancho mínimo fijo (pensado para
   * los slots circulares de campo); con `fullWidth` estira las 3 barras a todo el ancho
   * disponible del contenedor (tarjetas de plantilla con más espacio horizontal).
   */
  fullWidth?: boolean;
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
  formStatus,
  variant = "compact",
  className,
  onReadinessInfo,
  onFatigueInfo,
  onFormStatusInfo,
  fullWidth,
}: Props) {
  if (readiness == null && fatigue == null) return null;

  const fatigueValue = fatigue ?? null;
  const efValue =
    formStatus !== undefined
      ? formStatus
      : fatigueValue == null
        ? null
        : computeEf(readiness ?? null, fatigueValue);

  const efTone = toneOf("ef", efValue);
  const rTone = toneOf("r", readiness ?? null);
  const cTone = toneOf("c", fatigueValue);

  if (variant === "full") {
    return (
      <div className={`${styles.full} ${className ?? ""}`}>
        <InfoRow
          testId="player-form-bar-ef"
          label="Ef"
          value={efValue}
          tone={efTone}
          onInfo={onFormStatusInfo}
          rowClassName={styles.fullEfRow}
          labelClassName={styles.fullEfLabel}
          trackClassName={styles.fullTrack}
          fillClassName={styles.fullFill}
          valueClassName={styles.fullEfValue}
        />
        <div className={styles.fullChildren}>
          <InfoRow
            testId="player-form-bar-r"
            label="Rodaje"
            value={readiness ?? null}
            tone={rTone}
            onInfo={onReadinessInfo}
            rowClassName={styles.childRow}
            labelClassName={styles.childLabel}
            trackClassName={styles.childTrack}
            fillClassName={styles.childFill}
            valueClassName={styles.childValue}
          />
          <InfoRow
            testId="player-form-bar-c"
            label="Cansancio"
            value={fatigueValue}
            tone={cTone}
            onInfo={onFatigueInfo}
            rowClassName={styles.childRow}
            labelClassName={styles.childLabel}
            trackClassName={styles.childTrack}
            fillClassName={styles.childFill}
            valueClassName={styles.childValue}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.compact} ${fullWidth ? styles.compactFullWidth : ""} ${className ?? ""}`}
    >
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

type InfoRowProps = {
  testId: string;
  label: string;
  value: number | null;
  tone: "high" | "mid" | "low" | "none";
  onInfo?: () => void;
  rowClassName: string;
  labelClassName: string;
  trackClassName: string;
  fillClassName: string;
  valueClassName: string;
};

function InfoRow({
  testId,
  label,
  value,
  tone,
  onInfo,
  rowClassName,
  labelClassName,
  trackClassName,
  fillClassName,
  valueClassName,
}: InfoRowProps) {
  return (
    <div className={styles.rowWrapper}>
      <div className={rowClassName} data-testid={testId} data-tone={tone}>
        <span className={labelClassName}>{label}</span>
        <div className={trackClassName}>
          <div className={fillClassName} data-tone={tone} style={{ width: `${value ?? 0}%` }} />
        </div>
        <span className={valueClassName}>{formatValue(value)}</span>
        {onInfo && (
          <IconButton
            size="small"
            className={styles.infoButton}
            data-testid={`${testId}-toggle`}
            aria-label={`¿Cómo se calcula? ${label}`}
            onClick={onInfo}
          >
            <InfoOutlinedIcon fontSize="inherit" />
          </IconButton>
        )}
      </div>
    </div>
  );
}
