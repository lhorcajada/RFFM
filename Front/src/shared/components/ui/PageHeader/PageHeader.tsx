import React from "react";
import { Typography } from "@mui/material";
import styles from "./PageHeader.module.css";

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  children,
  className,
}) => (
  <div className={`${styles.header} ${className ?? ""}`.trim()}>
    <div className={styles.headerRow}>
      {subtitle && typeof subtitle !== "string" && (
        <div className={styles.leftBlock}>{subtitle}</div>
      )}
      {typeof title === "string" ? (
        <Typography className={styles.title}>{title}</Typography>
      ) : (
        <div className={styles.title}>{title}</div>
      )}
      {subtitle && typeof subtitle !== "string" && (
        <div className={styles.rightBlock} aria-hidden>
          {subtitle}
        </div>
      )}
    </div>
    {subtitle && typeof subtitle === "string" && (
      <Typography variant="body2" className={styles.subtitle}>
        {subtitle}
      </Typography>
    )}
    {children}
  </div>
);

export default PageHeader;
