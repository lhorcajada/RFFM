import { Chip, Tooltip } from "@mui/material";
import type { Habilidad } from "../../../../types/gameModel";
import styles from "./HabilidadChips.module.css";

function HabilidadDetail({ habilidad }: { habilidad: Habilidad }) {
  if (habilidad.referenciaAKey) return <span>{`Igual que ${habilidad.referenciaAKey}`}</span>;
  return (
    <span className={styles.detail}>
      {habilidad.descripcion && <span>{habilidad.descripcion}</span>}
      {habilidad.entrenable && <span>{`Entrenable: ${habilidad.entrenable}`}</span>}
    </span>
  );
}

/** Habilidades imprescindibles of one Sub-subprincipio as small chips; each chip's tooltip
 * (tap-to-open on touch) shows its descripción/entrenable or the "Igual que" reference. */
export default function HabilidadChips({ habilidades }: { habilidades: Habilidad[] }) {
  if (habilidades.length === 0) return null;

  return (
    <div className={styles.root}>
      {habilidades.map((habilidad) => (
        <Tooltip key={habilidad.apiId ?? habilidad.id} title={<HabilidadDetail habilidad={habilidad} />} enterTouchDelay={0}>
          <Chip label={habilidad.nombre} size="small" variant="outlined" className={styles.chip} />
        </Tooltip>
      ))}
    </div>
  );
}
