import React from "react";
import Paper from "@mui/material/Paper";
import { useLocation } from "react-router-dom";
import AppHeader from "../AppHeader/AppHeader";
import Footer from "../Footer/Footer";
import CoachTeamNav from "../../../../apps/coach/navigation/CoachTeamNav";
import { isTeamNavRoute } from "../../../../apps/coach/navigation/teamNavRoutes";
import styles from "./BaseLayout.module.css";

interface BaseLayoutProps {
  children: React.ReactNode;
  className?: string;
  appTitle?: string;
  hideFooterMenu?: boolean;
  hideHeaderIndicators?: boolean;
}

const BaseLayout: React.FC<BaseLayoutProps> = ({
  children,
  className,
  appTitle,
  hideFooterMenu,
  hideHeaderIndicators,
}) => {
  const { pathname } = useLocation();
  const showTeamNav = isTeamNavRoute(pathname);

  return (
    <Paper className={className ? `${styles.paper} ${className}` : styles.paper}>
      <div className={showTeamNav ? `${styles.layoutWrap} ${styles.withTeamNav}` : styles.layoutWrap}>
        <div className={styles.header}>
          <AppHeader title={appTitle} hideIndicators={hideHeaderIndicators} />
        </div>
        <div className={styles.content}>{children}</div>
        {showTeamNav && (
          <div className={styles.teamNav}>
            <CoachTeamNav />
          </div>
        )}
        <div className={styles.footer}>
          <Footer hideMenu={!!hideFooterMenu} teamNav={showTeamNav} />
        </div>
      </div>
    </Paper>
  );
};

export default BaseLayout;
