import { Button } from "@mui/material";

import styles from "./ConfigItemCard.module.css";

type Props = {
  label: string;
  /** Texto secundario, por ejemplo la categoría. */
  detail?: string;
  isCustom: boolean;
  isHidden: boolean;
  canManage: boolean;
  onEdit: () => void;
  onHide: () => void;
  onRestore: () => void;
};

/** Tarjeta de una capacidad o un rasgo en la configuración: marcas de propia y oculta, y sus acciones. */
export default function ConfigItemCard({ label, detail, isCustom, isHidden, canManage, onEdit, onHide, onRestore }: Props) {
  return (
    <li aria-label={label} className={`${styles.card} ${isHidden ? styles.cardHidden : ""}`}>
      <div className={styles.main}>
        <span className={styles.label}>{label}</span>
        {detail && <span className={styles.detail}>{detail}</span>}
        <span className={styles.badges}>
          {isCustom && <span className={styles.badge}>Propia</span>}
          {isHidden && <span className={`${styles.badge} ${styles.badgeHidden}`}>Oculta</span>}
        </span>
      </div>
      {canManage && (
        <div className={styles.actions}>
          <Button size="small" aria-label={`Editar ${label}`} onClick={onEdit}>
            Editar
          </Button>
          {isHidden ? (
            <Button size="small" aria-label={`Restaurar ${label}`} onClick={onRestore}>
              Restaurar
            </Button>
          ) : (
            <Button size="small" color="inherit" aria-label={`Ocultar ${label}`} onClick={onHide}>
              Ocultar
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
