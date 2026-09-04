import SummarizeIcon from "@mui/icons-material/Summarize";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import styles from "../../AttendanceSummary.module.css";
import AttendanceEventChart from "./AttendanceEventChart";
import type { DashboardData, Summary } from "./types";

function rate(summary: Summary): number {
  const total = summary.attend + summary.absent;
  if (total === 0) return 0;
  return Math.round((summary.attend / total) * 100);
}

interface Props {
  data: DashboardData;
}

export default function AttendanceDashboardTab({ data }: Props) {
  return (
    <div className={styles.grid}>
      <article className={styles.card} key="total">
        <div className={styles.cardHeader}>
          <div className={styles.iconWrap}>
            <SummarizeIcon fontSize="large" />
          </div>
          <h3 className={styles.cardTitle}>Resumen global</h3>
        </div>
        <div className={styles.metricMain}>
          <span className={styles.metricValue}>{rate(data.total)}%</span>
          <span className={styles.metricLabel}>Tasa de asistencia</span>
        </div>
        <div className={styles.metrics}>
          <div className={styles.metricItem}>
            <span className={styles.metricItemLabel}>Eventos</span>
            <strong>{data.total.events}</strong>
          </div>
          <div className={styles.metricItem}>
            <span className={styles.metricItemLabel}>Asisten</span>
            <strong>{data.total.attend}</strong>
          </div>
          <div className={styles.metricItem}>
            <span className={styles.metricItemLabel}>No asisten</span>
            <strong>{data.total.absent}</strong>
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
