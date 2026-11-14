import { useState } from "react";
import { MenuItem, TextField } from "@mui/material";

import ConfirmDialog from "../../../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import type { RatingView } from "../ratingViews";

import styles from "./RatingViewSwitcher.module.css";

type Props = {
  value: RatingView;
  hasUnsavedChanges: boolean;
  onChange: (next: RatingView) => void;
};

const VIEW_OPTIONS: { value: RatingView; label: string }[] = [
  { value: "capacity", label: "Capacidad" },
  { value: "traits", label: "Conducta en partido" },
  { value: "order", label: "Orden por puesto" },
  { value: "config", label: "Configurar" },
];

export default function RatingViewSwitcher({ value, hasUnsavedChanges, onChange }: Props) {
  const [pendingView, setPendingView] = useState<RatingView | null>(null);

  function requestChange(next: RatingView) {
    if (next === value) return;
    if (hasUnsavedChanges) setPendingView(next);
    else onChange(next);
  }

  function confirmChange() {
    if (pendingView) onChange(pendingView);
    setPendingView(null);
  }

  return (
    <>
      <TextField
        select
        size="small"
        label="Vista"
        value={value}
        className={styles.select}
        onChange={(e) => requestChange(e.target.value as RatingView)}
      >
        {VIEW_OPTIONS.map(({ value: optionValue, label }) => (
          <MenuItem key={optionValue} value={optionValue}>
            {label}
          </MenuItem>
        ))}
      </TextField>

      <ConfirmDialog
        open={pendingView !== null}
        title="Cambiar de vista"
        description="Hay cambios sin guardar en esta vista. ¿Quieres cambiar de vista de todos modos?"
        confirmText="Cambiar"
        onCancel={() => setPendingView(null)}
        onConfirm={confirmChange}
      />
    </>
  );
}
