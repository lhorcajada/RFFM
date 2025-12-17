import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import styles from "./CoachDialog.module.css";

type Props = {
  open: boolean;
  title: React.ReactNode;
  children?: React.ReactNode;
  onClose: () => void;
  actions?: React.ReactNode;
};

export default function CoachDialog({
  open,
  title,
  children,
  onClose,
  actions,
}: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{
        className: styles.paper,
        "data-coach-dialog": "true" as any,
      }}
    >
      <DialogTitle className={styles.title}>{title}</DialogTitle>
      <DialogContent className={styles.content}>{children}</DialogContent>
      <DialogActions className={styles.actions}>
        {actions ?? (
          <Button onClick={onClose} variant="contained" size="small">
            Cerrar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
