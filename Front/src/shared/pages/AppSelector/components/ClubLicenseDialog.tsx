import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";

interface ClubLicenseDialogProps {
  open: boolean;
  isProcessing: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export default function ClubLicenseDialog({
  open,
  isProcessing,
  onClose,
  onAccept,
}: ClubLicenseDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} aria-labelledby="club-license-dialog">
      <DialogTitle id="club-license-dialog">
        ¿Quieres activar la licencia gratuita de Club?
      </DialogTitle>
      <DialogContent>
        Al aceptar obtendrás 7 días gratuitos. Tras ese periodo se cobrará según los datos de
        facturación que proporciones (se abrirá el formulario más adelante).
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          disabled={isProcessing}
          variant="outlined"
          color="primary"
          sx={{
            "&.Mui-disabled": {
              color: (theme) => theme.palette.text.primary,
              borderColor: (theme) => theme.palette.action.disabledBackground,
              opacity: 1,
            },
          }}
          aria-label="Cancelar"
        >
          {isProcessing ? <CircularProgress size={18} /> : "Cancelar"}
        </Button>
        <Button
          onClick={onAccept}
          disabled={isProcessing}
          variant="contained"
          color="primary"
          aria-label="Aceptar 7 días"
          sx={{
            "&.Mui-disabled": {
              backgroundColor: (theme) => theme.palette.primary.main,
              color: (theme) => theme.palette.primary.contrastText,
              opacity: 0.9,
            },
            minWidth: 140,
          }}
        >
          {isProcessing ? (
            <>
              <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />
              Aceptando...
            </>
          ) : (
            "Aceptar 7 días"
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
