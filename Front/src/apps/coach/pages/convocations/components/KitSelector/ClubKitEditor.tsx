import { useState } from "react";
import Jersey from "../../../../../federation/components/players/Jersey/Jersey";
import { saveClubKits } from "../../../../services/kitService";
import type { ClubKit } from "../../../../services/kitService";
import { KIT_COLOR_PALETTE } from "../../utils/kitColors";
import styles from "./ClubKitEditor.module.css";

// Re-exported for backward compat — the palette now lives in utils/kitColors.ts, shared
// with convocationSummary.ts (WhatsApp text, "Ver convocatoria" popup).
export { KIT_COLOR_PALETTE };

type Props = {
  teamId: string;
  onSaved: (kits: ClubKit[]) => void;
  /** Real colors of the club's existing kits, used to precharge the editor when editing
   *  (instead of the palette defaults used when creating kits for the first time). */
  initialKits?: ClubKit[];
};

type IconProps = {
  color: string;
  size?: number;
  label: string;
};

function ShortsIcon({ color, size = 22, label }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ color }}
      role="img"
      aria-label={label}
    >
      <path
        fill="currentColor"
        d="M3 3h18v3l-1.5 2v13h-4l-.8-9.5-.7 9.5H12l-.9-9.5-.6 9.5H6.5V8L5 6V3z"
      />
    </svg>
  );
}

function SockIcon({ color, size = 22, label }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ color }}
      role="img"
      aria-label={label}
    >
      <path
        fill="currentColor"
        d="M8 2h7v9.2c0 .8.3 1.6.9 2.1l3.3 3.2c.9.9 1.4 2.1 1.4 3.4V22h-9a4 4 0 0 1-4-4v-6l-1-1V4a2 2 0 0 1 2-2z"
      />
    </svg>
  );
}

type ColorPickerProps = {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
};

function ColorPicker({ label, value, onChange, disabled }: ColorPickerProps) {
  return (
    <div className={styles.colorPicker}>
      <span className={styles.colorPickerLabel}>{label}</span>
      <div className={styles.swatchRow} role="group" aria-label={label}>
        {KIT_COLOR_PALETTE.map((color) => {
          const isSelected = color.hex.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={color.hex}
              type="button"
              className={`${styles.swatch} ${isSelected ? styles.swatchSelected : ""}`}
              style={{ backgroundColor: color.hex }}
              title={color.name}
              aria-label={color.name}
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => onChange(color.hex)}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function ClubKitEditor({ teamId, onSaved, initialKits }: Props) {
  const kit1 = initialKits?.find((k) => k.kitNumber === 1);
  const kit2 = initialKits?.find((k) => k.kitNumber === 2);

  const [shirt1, setShirt1] = useState(kit1?.shirtColor ?? KIT_COLOR_PALETTE[1].hex);
  const [shorts1, setShorts1] = useState(kit1?.shortsColor ?? KIT_COLOR_PALETTE[1].hex);
  const [socks1, setSocks1] = useState(kit1?.socksColor ?? KIT_COLOR_PALETTE[1].hex);
  const [shirt2, setShirt2] = useState(kit2?.shirtColor ?? KIT_COLOR_PALETTE[2].hex);
  const [shorts2, setShorts2] = useState(kit2?.shortsColor ?? KIT_COLOR_PALETTE[3].hex);
  const [socks2, setSocks2] = useState(kit2?.socksColor ?? KIT_COLOR_PALETTE[3].hex);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveClubKits(teamId, [
        { kitNumber: 1, shirtColor: shirt1, shortsColor: shorts1, socksColor: socks1 },
        { kitNumber: 2, shirtColor: shirt2, shortsColor: shorts2, socksColor: socks2 },
      ]);
      onSaved(saved);
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Error al guardar las equipaciones. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.root}>
      <span className={styles.title}>Configura las equipaciones del club</span>

      <div className={styles.kitsRow}>
        <div className={styles.kitBlock}>
          <div className={styles.kitBlockHeader}>
            <div className={styles.kitPreviewRow}>
              <Jersey primary={shirt1} size={40} />
              <ShortsIcon color={shorts1} label="Vista previa color de pantalón, 1ª equipación" />
              <SockIcon color={socks1} label="Vista previa color de medias, 1ª equipación" />
            </div>
            <span className={styles.kitBlockLabel}>1ª equipación</span>
          </div>
          <ColorPicker label="Color de camiseta" value={shirt1} onChange={setShirt1} disabled={saving} />
          <ColorPicker label="Color de pantalón" value={shorts1} onChange={setShorts1} disabled={saving} />
          <ColorPicker label="Color de medias" value={socks1} onChange={setSocks1} disabled={saving} />
        </div>

        <div className={styles.kitBlock}>
          <div className={styles.kitBlockHeader}>
            <div className={styles.kitPreviewRow}>
              <Jersey primary={shirt2} size={40} />
              <ShortsIcon color={shorts2} label="Vista previa color de pantalón, 2ª equipación" />
              <SockIcon color={socks2} label="Vista previa color de medias, 2ª equipación" />
            </div>
            <span className={styles.kitBlockLabel}>2ª equipación</span>
          </div>
          <ColorPicker label="Color de camiseta" value={shirt2} onChange={setShirt2} disabled={saving} />
          <ColorPicker label="Color de pantalón" value={shorts2} onChange={setShorts2} disabled={saving} />
          <ColorPicker label="Color de medias" value={socks2} onChange={setSocks2} disabled={saving} />
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={saving}>
        {saving ? "Guardando…" : "Guardar equipaciones"}
      </button>
    </div>
  );
}
