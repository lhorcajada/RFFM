import React from "react";
import { Typography } from "@mui/material";
import styles from "./PageHeader.module.css";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
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
    {subtitle && (
      <Typography variant="body2" className={styles.subtitle}>
        {subtitle}
      </Typography>
    )}
    {children}
  </div>
);

export default PageHeader;
