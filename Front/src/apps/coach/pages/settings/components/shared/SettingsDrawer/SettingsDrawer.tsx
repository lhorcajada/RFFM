import React from "react";
import { Drawer, IconButton, Typography, useMediaQuery } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import styles from "./SettingsDrawer.module.css";

interface SettingsDrawerProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function SettingsDrawer({ open, title, subtitle, onClose, children }: SettingsDrawerProps) {
  const isMobile = useMediaQuery("(max-width:600px)");

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      aria-labelledby="settings-drawer-title"
      PaperProps={{
        role: "dialog",
        "aria-labelledby": "settings-drawer-title",
        className: styles.paper,
        style: { width: isMobile ? "100%" : 460 },
      }}
    >
      <div className={styles.header}>
        <div className={styles.headerText}>
          <Typography id="settings-drawer-title" component="h2" className={styles.title}>
            {title}
          </Typography>
          {subtitle && <Typography className={styles.subtitle}>{subtitle}</Typography>}
        </div>
        <IconButton onClick={onClose} aria-label="Cerrar" className={styles.close}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>
      <div className={styles.body}>{children}</div>
    </Drawer>
  );
}
