import React from "react";
import { Typography } from "@mui/material";
import styles from "./PageHeader.module.css";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  children,
}) => (
  <div className={styles.header}>
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
