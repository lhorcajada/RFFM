import { Box, Button, CircularProgress } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import styles from "./MobileSaveCancelBar.module.css";

interface Props {
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  saveLabel: string;
}

export default function MobileSaveCancelBar({ onSave, onCancel, saving, saveLabel }: Props) {
  return (
    <Box className={styles.bar} role="region" aria-label="Acciones del formulario">
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={onCancel}
        variant="outlined"
        size="small"
        className={styles.cancelBtn}
      >
        Cancelar
      </Button>
      <Button
        startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
        onClick={onSave}
        variant="contained"
        size="small"
        color="primary"
        disabled={saving}
        className={styles.saveBtn}
      >
        {saving ? "Guardando…" : saveLabel}
      </Button>
    </Box>
  );
}
