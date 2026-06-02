import React, { ReactNode } from "react";
import { Link } from "react-router-dom";
import styles from "./DashboardCard.module.css";

export default function DashboardCard({
  title,
  description,
  icon,
  to,
  footer,
  className,
  iconClassName,
  titleClassName,
  descriptionClassName,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  to: string;
  footer?: ReactNode;
  className?: string;
  iconClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}) {
  if (footer) {
    return (
      <article className={`${styles.cardShell} ${className ?? ""}`.trim()}>
        <Link to={to} className={styles.mainLink} aria-label={title}>
          <div className={`${styles.iconWrap} ${iconClassName ?? ""}`.trim()}>{icon}</div>
          <span className={`${styles.title} ${titleClassName ?? ""}`.trim()}>{title}</span>
          {description && (
            <span className={`${styles.description} ${descriptionClassName ?? ""}`.trim()}>
              {description}
            </span>
          )}
        </Link>
        <div className={styles.footer}>{footer}</div>
      </article>
    );
  }

  return (
    <Link to={to} className={`${styles.card} ${className ?? ""}`.trim()} aria-label={title}>
      <div className={`${styles.iconWrap} ${iconClassName ?? ""}`.trim()}>{icon}</div>
      <span className={`${styles.title} ${titleClassName ?? ""}`.trim()}>{title}</span>
      {description && (
        <span className={`${styles.description} ${descriptionClassName ?? ""}`.trim()}>
          {description}
        </span>
      )}
    </Link>
  );
}
