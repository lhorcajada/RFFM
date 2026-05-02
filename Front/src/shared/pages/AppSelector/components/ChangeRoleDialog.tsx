import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";

interface ChangeRoleDialogProps {
  open: boolean;
  onClose: () => void;
  onKeep: () => void;
  onChange: () => void;
}

export default function ChangeRoleDialog({ open, onClose, onKeep, onChange }: ChangeRoleDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} aria-labelledby="change-role-dialog">
      <DialogTitle id="change-role-dialog">¿Quieres cambiar de rol?</DialogTitle>
      <DialogContent>
        Ya tienes un rol asignado. Puedes continuar con él o elegir uno diferente.
      </DialogContent>
      <DialogActions>
        <Button onClick={onKeep} variant="outlined" color="primary" aria-label="Continuar con mi rol">
          Continuar
        </Button>
        <Button onClick={onChange} variant="contained" color="primary" aria-label="Cambiar de rol">
          Cambiar de rol
        </Button>
      </DialogActions>
    </Dialog>
  );
}
