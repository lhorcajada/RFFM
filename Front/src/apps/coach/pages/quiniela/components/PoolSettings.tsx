import { useEffect, useState } from "react";
import { Button, TextField } from "@mui/material";
import styles from "./PoolSettings.module.css";

type Props = {
  fundPercent: number;
  saving: boolean;
  onSave: (fundPercent: number) => void;
};

export default function PoolSettings({ fundPercent, saving, onSave }: Props) {
  const [value, setValue] = useState(String(fundPercent));

  useEffect(() => {
    setValue(String(fundPercent));
  }, [fundPercent]);

  const parsed = value.trim() === "" ? Number.NaN : Number(value);
  const valid = Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
  const unchanged = valid && parsed === fundPercent;

  return (
    <section className={styles.card} aria-labelledby="quiniela-settings-title">
      <h2 id="quiniela-settings-title" className={styles.title}>Reparto de lo cobrado</h2>
      <p className={styles.help}>
        Porcentaje de cada boleto que va al fondo del equipo. El resto se reparte en premios. Se aplica también a la
        jornada abierta.
      </p>
      <TextField
        type="number"
        size="small"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        error={!valid}
        helperText={valid ? `Premios: ${100 - parsed} %` : "Indica un valor entre 0 y 100"}
        inputProps={{ min: 0, max: 100, step: 1, "aria-label": "Porcentaje para el fondo del equipo" }}
      />
      <Button
        variant="contained"
        size="small"
        className={styles.button}
        disabled={!valid || unchanged || saving}
        onClick={() => onSave(parsed)}
      >
        Guardar reparto
      </Button>
    </section>
  );
}
