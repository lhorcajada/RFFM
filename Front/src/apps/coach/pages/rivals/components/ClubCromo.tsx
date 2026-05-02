import React from "react";
import styles from "./ClubCromo.module.css";
import { Button, Tooltip } from "@mui/material";
import avatarFallback from "../../../../../assets/avatar.svg";

type Props = {
  id?: string;
  name: string;
  image?: string | null;
  category?: string | null;
  onImport?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  importLabel?: string;
};

export default function ClubCromo({ id, name, image, category, onImport, onEdit, onDelete, importLabel }: Props) {
  return (
    <div className={styles.card} data-id={id}>
      <div className={styles.photoArea}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={name} className={styles.photo} />
        ) : (
          <div className={styles.photoFallback}>{name.charAt(0)}</div>
        )}
        <div className={styles.photoGradient} />
      </div>
      <div className={styles.body}>
        <div className={styles.teamName} title={name}>{name}</div>
        {category ? <div className={styles.category}>{category}</div> : null}
      </div>
      <div className={styles.footer}>
        {onEdit ? (
          <Tooltip title="Editar">
            <Button size="small" className={styles.btn} onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              Editar
            </Button>
          </Tooltip>
        ) : null}
        {onDelete ? (
          <Tooltip title="Eliminar">
            <Button size="small" color="error" className={styles.btn} onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              Eliminar
            </Button>
          </Tooltip>
        ) : null}
        {onImport ? (
          <Button size="small" variant="contained" onClick={(e) => { e.stopPropagation(); onImport(); }}>
            {importLabel ?? "Importar"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
