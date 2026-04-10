import { useState } from "react";
import SettingsIcon from "@mui/icons-material/Settings";
import styles from "./SimulationConfig.module.css";

interface SimulationConfigProps {
  halfDuration: number;
  onHalfDurationChange: (minutes: number) => void;
}

const PRESET_DURATIONS = [25, 30, 35, 40, 45];

export default function SimulationConfig({
  halfDuration,
  onHalfDurationChange,
}: SimulationConfigProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(String(halfDuration));

  function handlePreset(min: number) {
    onHalfDurationChange(min);
    setInputValue(String(min));
  }

  function handleInputChange(val: string) {
    setInputValue(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 5 && parsed <= 90) {
      onHalfDurationChange(parsed);
    }
  }

  return (
    <div className={styles.root}>
      <button
        className={`${styles.toggle} ${open ? styles.toggleOpen : ""}`}
        onClick={() => setOpen((v) => !v)}
        title="Configuración del partido"
      >
        <SettingsIcon sx={{ fontSize: 16 }} />
        <span>Config</span>
        {!open && (
          <span className={styles.currentValue}>{halfDuration} min/parte</span>
        )}
      </button>

      {open && (
        <div className={styles.panel}>
          <span className={styles.label}>Duración de cada parte</span>

          <div className={styles.presets}>
            {PRESET_DURATIONS.map((min) => (
              <button
                key={min}
                className={`${styles.preset} ${halfDuration === min ? styles.presetActive : ""}`}
                onClick={() => handlePreset(min)}
              >
                {min}&apos;
              </button>
            ))}
          </div>

          <div className={styles.customRow}>
            <span className={styles.customLabel}>Personalizado:</span>
            <input
              type="number"
              min={5}
              max={90}
              className={styles.customInput}
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
            />
            <span className={styles.customUnit}>min</span>
          </div>
        </div>
      )}
    </div>
  );
}
