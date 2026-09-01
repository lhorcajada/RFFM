import { Box, Button, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import styles from "./MobileEditorBlocked.module.css";

interface MobileEditorBlockedProps {
  onBack: () => void;
}

export default function MobileEditorBlocked({ onBack }: MobileEditorBlockedProps) {
  return (
    <Box className={styles.wrap}>
      <DesktopWindowsIcon className={styles.icon} />
      <Typography className={styles.title}>Editor de ejercicios no disponible</Typography>
      <Typography className={styles.text}>
        Crear o editar ejercicios no está disponible desde dispositivos móviles. Usa una
        tablet o un ordenador para diseñar el ejercicio sobre el campo.
      </Typography>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={onBack}
        variant="outlined"
        className={styles.backBtn}
      >
        Volver
      </Button>
    </Box>
  );
}
