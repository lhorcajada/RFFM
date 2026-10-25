import type { ReactNode } from "react";
import styles from "./DashboardHeader.module.css";

interface DashboardHeaderProps {
  name: string | null;
  action?: ReactNode;
  compact?: boolean;
}

export default function DashboardHeader({ name, action, compact = false }: DashboardHeaderProps) {
  const title = name ? `Hola, ${name}` : "Panel de control";

  return (
    <header className={`${styles.header} ${compact ? styles.compact : ""}`.trim()}>
      <div className={styles.titles}>
        <span className={styles.eyebrow}>Panel de control</span>
        <h1 className={styles.title}>{title}</h1>
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </header>
  );
}
