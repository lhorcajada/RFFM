import { format } from "date-fns";
import type { ClassificationTeamMatch } from "../../../../../shared/hooks/useClassification";
import FormBadges from "./FormBadges";
import styles from "./ResultRow.module.css";

function formatDate(date: string | null): string {
  const parsed = new Date(date ?? "");
  return Number.isNaN(parsed.getTime()) ? "" : format(parsed, "dd/MM");
}

function formatScore(match: ClassificationTeamMatch): string {
  if (!match.scoreLeft && !match.scoreRight) return "–";
  return `${match.scoreLeft}-${match.scoreRight}`;
}

export default function ResultRow({ match }: { match: ClassificationTeamMatch }) {
  return (
    <li className={styles.row}>
      <span className={styles.date}>{formatDate(match.date)}</span>
      <span className={styles.opponent}>{match.opponent || "Rival"}</span>
      <span className={styles.score}>{formatScore(match)}</span>
      <FormBadges form={[match.result]} size="small" />
    </li>
  );
}
