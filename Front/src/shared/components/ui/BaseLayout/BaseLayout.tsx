import React from "react";
import Paper from "@mui/material/Paper";
import AppHeader from "../AppHeader/AppHeader";
import styles from "./BaseLayout.module.css";

interface BaseLayoutProps {
  children: React.ReactNode;
  className?: string;
  appTitle?: string;
}

const BaseLayout: React.FC<BaseLayoutProps> = ({
  children,
  className,
  appTitle,
}) => (
  <Paper className={className ? `${styles.paper} ${className}` : styles.paper}>
    <div className={styles.layoutWrap}>
      <div className={styles.header}>
        <AppHeader title={appTitle} />
      </div>
      <div className={styles.content}>{children}</div>
      <div className={styles.footer}></div>
    </div>
  </Paper>
);

export default BaseLayout;
