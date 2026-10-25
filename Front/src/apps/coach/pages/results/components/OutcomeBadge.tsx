import type { Outcome } from "../utils/ownMatch";
import styles from "./OutcomeBadge.module.css";

const VARIANT: Record<Outcome, string> = { V: styles.win, E: styles.draw, D: styles.loss };

type Props = {
  outcome: Outcome;
  size?: "sm" | "lg";
  inverted?: boolean;
  children?: React.ReactNode;
};

export default function OutcomeBadge({ outcome, size = "sm", inverted = false, children }: Props) {
  const className = [styles.badge, styles[size], VARIANT[outcome], inverted ? styles.inverted : ""].filter(Boolean).join(" ");
  return <span className={className}>{children ?? outcome}</span>;
}
