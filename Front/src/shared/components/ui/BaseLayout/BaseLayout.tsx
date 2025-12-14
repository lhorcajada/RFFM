import React from "react";
import Paper from "@mui/material/Paper";
import AppHeader from "../AppHeader/AppHeader";
import Footer from "../Footer/Footer";
import styles from "./BaseLayout.module.css";

interface BaseLayoutProps {
  children: React.ReactNode;
  className?: string;
  appTitle?: string;
  hideFooterMenu?: boolean;
}

const BaseLayout: React.FC<BaseLayoutProps> = ({
  children,
  className,
  appTitle,
  hideFooterMenu,
}) => (
  <Paper className={className ? `${styles.paper} ${className}` : styles.paper}>
    <div className={styles.layoutWrap}>
      <div className={styles.header}>
        {appTitle ? <AppHeader title={appTitle} /> : <AppHeader />}
      </div>
      <div className={styles.content}>{children}</div>
      <div className={styles.footer}>
        <Footer hideMenu={!!hideFooterMenu} />
      </div>
    </div>
  </Paper>
);

export default BaseLayout;
