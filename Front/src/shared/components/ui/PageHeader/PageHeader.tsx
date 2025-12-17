import React from "react";
import { Typography } from "@mui/material";
import styles from "./PageHeader.module.css";

interface PageHeaderProps {
  title: string;
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
    <Typography className={styles.title}>{title}</Typography>
    {subtitle &&
      (typeof subtitle === "string" ? (
        <Typography variant="body2" className={styles.subtitle}>
          {subtitle}
        </Typography>
      ) : (
        <div className={styles.subtitle}>{subtitle}</div>
      ))}
    {children}
  </div>
);

export default PageHeader;
