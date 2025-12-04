import React from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import styles from "./AppHeader.module.css";
import { useUser } from "../../../../../shared/context/UserContext";

interface AppHeaderProps {
  title?: string;
}

export default function AppHeader({ title = "Entrenadores" }: AppHeaderProps) {
  const { user } = useUser();

  return (
    <AppBar position="static" className={styles.appBar} color="transparent">
      <Toolbar className={styles.toolbar}>
        <Typography variant="h6" component="div" className={styles.appName}>
          {title}
        </Typography>
        {user && (
          <Box className={styles.userSection}>
            <Avatar
              src={user.avatar}
              alt={user.username}
              className={styles.avatar}
            >
              {user.username.charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="body2" className={styles.username}>
              {user.username}
            </Typography>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}
