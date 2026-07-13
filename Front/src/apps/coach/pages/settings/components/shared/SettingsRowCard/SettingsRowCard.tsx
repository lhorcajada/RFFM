import React from "react";
import { Typography } from "@mui/material";
import styles from "./SettingsRowCard.module.css";

export interface SettingsRowCardField {
  label: string;
  value: React.ReactNode;
}

interface SettingsRowCardProps {
  title: React.ReactNode;
  fields: SettingsRowCardField[];
  actions?: React.ReactNode;
  className?: string;
  "data-testid"?: string;
}

/**
 * FC26-inspired card used to render a single table row as a standalone card
 * on mobile/tablet breakpoints, replacing horizontally-scrolling MUI tables.
 */
export default function SettingsRowCard({
  title,
  fields,
  actions,
  className,
  ["data-testid"]: dataTestId,
}: SettingsRowCardProps) {
  return (
    <article
      className={`${styles.card} ${className ?? ""}`.trim()}
      data-testid={dataTestId}
      role="group"
      aria-label={typeof title === "string" ? title : undefined}
    >
      <Typography variant="subtitle2" component="h3" className={styles.title}>
        {title}
      </Typography>

      <dl className={styles.fields}>
        {fields.map((field, index) => (
          <div className={styles.fieldRow} key={`${field.label}-${index}`}>
            <dt className={styles.fieldLabel}>{field.label}</dt>
            <dd className={styles.fieldValue}>{field.value}</dd>
          </div>
        ))}
      </dl>

      {actions && <div className={styles.actions}>{actions}</div>}
    </article>
  );
}
