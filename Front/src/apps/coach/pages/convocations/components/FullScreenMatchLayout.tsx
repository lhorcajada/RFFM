import type { ReactNode } from "react";
import { Button, CircularProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import styles from "./FullScreenMatchLayout.module.css";

type Props = {
  onBack: () => void;
  /** Acciones propias de la pantalla (Guardar, motivos…), a la izquierda de "Volver". */
  actions?: ReactNode;
  /** Mientras se carga el partido se muestra un spinner en lugar del contenido. */
  loading?: boolean;
  /** Partido no encontrado: aviso en lugar del contenido. */
  notFound?: boolean;
  children: ReactNode;
};

/** Pantalla completa de partido (alineación, simulación, partido en directo): sin cabecera
 *  ni pie de la app, solo una barra mínima con las acciones y "Volver" a la derecha. */
export default function FullScreenMatchLayout({ onBack, actions, loading = false, notFound = false, children }: Props) {
  return (
    <div className={styles.page}>
      <div className={styles.bar}>
        <div className={styles.actions}>{actions}</div>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} variant="outlined" size="small">
          Volver
        </Button>
      </div>
      <div className={styles.content}>
        {loading ? (
          <div className={styles.center}>
            <CircularProgress />
          </div>
        ) : notFound ? (
          <div className={styles.center}>
            <EmptyState description="No se encontró el partido. Vuelve a la ficha del partido e inténtalo de nuevo." />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
