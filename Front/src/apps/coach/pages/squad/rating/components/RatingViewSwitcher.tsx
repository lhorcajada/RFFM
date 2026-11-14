import { useState } from "react";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";

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
];

export default function RatingViewSwitcher({ value, hasUnsavedChanges, onChange }: Props) {
  const [pendingView, setPendingView] = useState<RatingView | null>(null);

  function requestChange(next: RatingView | null) {
    if (next == null || next === value) return;
    if (hasUnsavedChanges) setPendingView(next);
    else onChange(next);
  }

  function confirmChange() {
    if (pendingView) onChange(pendingView);
    setPendingView(null);
  }

  return (
    <>
      <ToggleButtonGroup
        value={value}
        exclusive
        size="small"
        aria-label="Vista de valoración"
        className={styles.switcher}
        onChange={(_, next: RatingView | null) => requestChange(next)}
      >
        {VIEW_OPTIONS.map(({ value: optionValue, label }) => (
          <ToggleButton key={optionValue} value={optionValue} className={styles.toggleBtn}>
            {label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

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
