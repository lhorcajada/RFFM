import React from "react";
import styles from "./CalendarFilters.module.css";
import Typography from "@mui/material/Typography";

function readStoredSelection() {
  try {
    const cur = localStorage.getItem("rffm.current_selection");
    if (cur) return JSON.parse(cur);

    const STORAGE_PRIMARY = "rffm.primary_combination_id";
    const STORAGE_KEY = "rffm.saved_combinations_v1";
    const primaryId = localStorage.getItem(STORAGE_PRIMARY);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!primaryId || !stored) return null;
    const combos = JSON.parse(stored || "[]");
    let primary: any = null;
    if (Array.isArray(combos) && combos.length > 0) {
      const foundById = combos.find(
        (c: any) => String(c.id) === String(primaryId)
      );
      if (foundById) primary = foundById;
      if (!primary) primary = combos.find((c: any) => c.isPrimary) || combos[0];
    }
    return primary;
  } catch (e) {
    return null;
  }
}

export default function CalendarFilters({ noConfig }: { noConfig: boolean }) {
  const stored = readStoredSelection();
  if (noConfig || !stored) {
    return (
      <div className={styles.filters}>
        <Typography variant="body2" className={styles.noConfig}>
          No hay configuración principal guardada.
        </Typography>
      </div>
    );
  }

  // The competition/group are shown in the app header; nothing to render here.
  return null;
}
