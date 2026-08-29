import SummarizeIcon from "@mui/icons-material/Summarize";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import styles from "../../AttendanceSummary.module.css";
import type { Summary, SummaryByType } from "./types";

function rate(summary: Summary): number {
  const total = summary.attend + summary.absent;
  if (total === 0) return 0;
  return Math.round((summary.attend / total) * 100);
}

interface Props {
  summary: SummaryByType;
}

export default function AttendanceDashboardTab({ summary }: Props) {
  const cards = [
    {
      key: "total",
      title: "Resumen global",
      icon: <SummarizeIcon fontSize="large" />,
      data: summary.total,
    },
    {
      key: "training",
      title: "Entrenamientos",
      icon: <FitnessCenterIcon fontSize="large" />,
      data: summary.training,
    },
    {
      key: "match",
      title: "Partidos",
      icon: <SportsSoccerIcon fontSize="large" />,
      data: summary.match,
    },
    {
      key: "other",
      title: "Otros eventos",
      icon: <HelpOutlineIcon fontSize="large" />,
      data: summary.other,
    },
  ];

  return (
    <div className={styles.grid}>
      {cards.map((card) => (
        <article className={styles.card} key={card.key}>
          <div className={styles.cardHeader}>
            <div className={styles.iconWrap}>{card.icon}</div>
            <h3 className={styles.cardTitle}>{card.title}</h3>
          </div>
          <div className={styles.metricMain}>
            <span className={styles.metricValue}>{rate(card.data)}%</span>
            <span className={styles.metricLabel}>Tasa de asistencia</span>
          </div>
          <div className={styles.metrics}>
            <div className={styles.metricItem}>
              <span className={styles.metricItemLabel}>Eventos</span>
              <strong>{card.data.events}</strong>
            </div>
            <div className={styles.metricItem}>
              <span className={styles.metricItemLabel}>Asisten</span>
              <strong>{card.data.attend}</strong>
            </div>
            <div className={styles.metricItem}>
              <span className={styles.metricItemLabel}>No asisten</span>
              <strong>{card.data.absent}</strong>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
