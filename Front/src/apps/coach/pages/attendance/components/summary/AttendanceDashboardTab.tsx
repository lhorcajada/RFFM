import SummarizeIcon from "@mui/icons-material/Summarize";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import styles from "../../AttendanceSummary.module.css";
import AttendanceEventChart from "./AttendanceEventChart";
import type { DashboardData, Summary } from "./types";

const RING_RADIUS = 42;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function rate(summary: Summary): number {
  const total = summary.attend + summary.absent;
  if (total === 0) return 0;
  return Math.round((summary.attend / total) * 100);
}

interface Props {
  data: DashboardData;
}

export default function AttendanceDashboardTab({ data }: Props) {
  const globalRate = rate(data.total);

  return (
    <div className={styles.grid}>
      <article className={`${styles.card} ${styles.globalCard}`} key="total">
        <div className={styles.cardHeader}>
          <div className={styles.iconWrap}>
            <SummarizeIcon fontSize="large" />
          </div>
          <h3 className={styles.cardTitle}>Resumen global</h3>
        </div>
        <div className={styles.globalBody}>
          <div className={styles.ring} role="img" aria-label={`Asistencia global: ${globalRate}%`}>
            <svg viewBox="0 0 100 100" className={styles.ringSvg} aria-hidden="true">
              <circle cx="50" cy="50" r={RING_RADIUS} className={styles.ringTrack} />
              <circle
                cx="50"
                cy="50"
                r={RING_RADIUS}
                className={styles.ringValue}
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - globalRate / 100)}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className={styles.ringCenter}>
              <span className={styles.ringPercent}>{globalRate}%</span>
              <span className={styles.ringCaption}>Tasa de asistencia</span>
            </div>
          </div>
          <div className={styles.globalStats}>
            <div className={styles.globalStat}>
              <span className={styles.metricItemLabel}>Eventos</span>
              <strong>{data.total.events}</strong>
            </div>
            <div className={styles.globalStat}>
              <span className={styles.metricItemLabel}>Asisten</span>
              <strong>{data.total.attend}</strong>
            </div>
            <div className={styles.globalStat}>
              <span className={styles.metricItemLabel}>No asisten</span>
              <strong>{data.total.absent}</strong>
            </div>
          </div>
        </div>
      </article>

      <AttendanceEventChart
        title="Entrenamientos"
        icon={<FitnessCenterIcon fontSize="large" />}
        color="var(--chart-training)"
        aggregate={data.training.summary}
        events={data.training.events}
      />

      <AttendanceEventChart
        title="Partidos"
        icon={<SportsSoccerIcon fontSize="large" />}
        color="var(--chart-match)"
        aggregate={data.match.summary}
        events={data.match.events}
      />

      <AttendanceEventChart
        title="Otros eventos"
        icon={<HelpOutlineIcon fontSize="large" />}
        color="var(--chart-other)"
        aggregate={data.other.summary}
        events={data.other.events}
      />
    </div>
  );
}
