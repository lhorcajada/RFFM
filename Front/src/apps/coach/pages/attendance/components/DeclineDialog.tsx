import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import type { ExcuseType } from "../../services/excuseTypeService";
import styles from "../AttendanceTabs.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  excuseTypes: ExcuseType[];
  onAccept: (excuseTypeId?: number | null) => void;
  title?: string;
};

export default function DeclineDialog({
  open,
  onClose,
  excuseTypes,
  onAccept,
  title = "Seleccionar justificante",
}: Props) {
  const [value, setValue] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!open) setValue(null);
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>{title}</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {excuseTypes.map((ex) => {
            const isActive = value === ex.id;
            return (
              <button
                key={ex.id}
                onClick={() => setValue(ex.id)}
                className={`${styles.dialogOptionBtn} ${styles.dialogOptionBtnOrange}${isActive ? " " + styles.dialogOptionBtnActive : ""}`}
              >
                <span>{ex.name}</span>
                {ex.justified && (
                  <span style={{ fontSize: "0.72rem", opacity: 0.75, fontWeight: 600 }}>Justificado</span>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          onClick={() => {
            onAccept(value);
            onClose();
          }}
          variant="contained"
        >
          Aceptar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
