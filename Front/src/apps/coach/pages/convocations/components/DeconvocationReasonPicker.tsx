import { useState } from "react";
import { Dialog } from "@mui/material";
import type { ExcuseType } from "../../../services/excuseTypeService";
import styles from "./DeconvocationReasonPicker.module.css";

type Props = {
  playerName: string;
  excuseTypes: ExcuseType[];
  /** Reason preselected when the coach is changing an existing one. */
  initialExcuseId?: number | null;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (excuseId: number) => void;
};

export default function DeconvocationReasonPicker({
  playerName,
  excuseTypes,
  initialExcuseId = null,
  confirmLabel = "Desconvocar",
  onCancel,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState<number | null>(initialExcuseId);

  return (
    <Dialog
      open
      onClose={onCancel}
      fullWidth
      maxWidth="xs"
      aria-labelledby="deconvocation-reason-title"
      classes={{ container: styles.container, paper: styles.paper }}
    >
      <div className={styles.handle} aria-hidden="true" />
      <h2 id="deconvocation-reason-title" className={styles.title}>
        Motivo de desconvocatoria
      </h2>
      <p className={styles.player}>{playerName}</p>

      <div role="radiogroup" aria-labelledby="deconvocation-reason-title" className={styles.options}>
        {excuseTypes.map((et) => (
          <label key={et.id} className={`${styles.option} ${selected === et.id ? styles.optionSelected : ""}`}>
            <input
              type="radio"
              name="deconvocation-reason"
              value={et.id}
              checked={selected === et.id}
              onChange={() => setSelected(et.id)}
              className={styles.radio}
            />
            <span className={styles.optionLabel}>{et.name}</span>
          </label>
        ))}
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className={styles.confirmBtn}
          disabled={selected === null}
          onClick={() => selected !== null && onConfirm(selected)}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
