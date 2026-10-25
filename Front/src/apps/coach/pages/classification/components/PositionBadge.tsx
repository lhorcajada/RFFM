import styles from "./PositionBadge.module.css";

type PositionBadgeProps = {
  position: number;
  size?: "small" | "large";
  suffix?: string;
};

export default function PositionBadge({ position, size = "small", suffix = "" }: PositionBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[size]}`}>
      {position}
      {suffix}
    </span>
  );
}
