import React from "react";
import styles from "./EmptyState.module.css";
import { Typography } from "@mui/material";

interface EmptyStateProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({ title, description }) => {
  return (
    <div className={styles.empty}>
      {title && (
        <Typography variant="h6" className={styles.title}>
          {title}
        </Typography>
      )}
      {description && (
        <Typography variant="body1" className={styles.description}>
          {description}
        </Typography>
      )}
    </div>
  );
};

export default EmptyState;
