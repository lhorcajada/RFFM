import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import type { ExcuseType } from "../../../services/excuseTypeService";
import styles from "../AttendanceTabs.module.css";

export const TECHNICAL_DECISION = "technical";

type Props = {
  open: boolean;
  onClose: () => void;
  excuseTypes: ExcuseType[];
  onConfirm: (reason: string) => void;
  hideTechnical?: boolean;
  title?: string;
  confirmLabel?: string;
};

const TECHNICAL_NAMES = ["decisión técnica", "decision tecnica", "technical decision"];

const ALL_OPTIONS = (excuseTypes: ExcuseType[], hideTechnical?: boolean) => [
  ...(hideTechnical ? [] : [{ value: "technical", label: "Decisión técnica", justified: false }]),
  ...excuseTypes
    .filter((ex) => !TECHNICAL_NAMES.includes(ex.name.toLowerCase()))
    .map((ex) => ({ value: String(ex.id), label: ex.name, justified: ex.justified ?? false })),
];

export default function DeconvokeDialog({ open, onClose, excuseTypes, onConfirm, hideTechnical, title, confirmLabel }: Props) {
  const [value, setValue] = React.useState<string>("");

  React.useEffect(() => {
    if (!open) setValue("");
  }, [open]);

  const options = ALL_OPTIONS(excuseTypes, hideTechnical);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>{title ?? "Motivo de desconvocatoria"}</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {options.map((opt) => {
            const isActive = value === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setValue(opt.value)}
                className={`${styles.dialogOptionBtn} ${styles.dialogOptionBtnRed}${isActive ? " " + styles.dialogOptionBtnActive : ""}`}
              >
                <span>{opt.label}</span>
                {opt.justified && (
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
          disabled={!value}
          onClick={() => {
            onConfirm(value);
            onClose();
          }}
          variant="contained"
          color="error"
        >
          {confirmLabel ?? (hideTechnical ? "Rechazar" : "Desconvocar")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
