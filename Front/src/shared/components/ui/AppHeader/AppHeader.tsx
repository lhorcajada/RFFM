import React from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import styles from "./AppHeader.module.css";

interface AppHeaderProps {
  title?: string;
}

export default function AppHeader({ title = "RFFM App" }: AppHeaderProps) {
  return (
    <AppBar position="static" className={styles.appBar} color="transparent">
      <Toolbar className={styles.toolbar}>
        <Typography variant="h6" component="div" className={styles.appName}>
          {title}
        </Typography>
      </Toolbar>
    </AppBar>
  );
}
