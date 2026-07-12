import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from "@mui/material";
import React from "react";
import type { UserType, UserTypeOption } from "../../../constants/userTypes";
import { USER_TYPE_OPTIONS } from "../../../constants/userTypes";

export type { UserType };

interface UserTypeDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (type: UserType) => void;
}

export default function UserTypeDialog({ open, onClose, onSelect }: UserTypeDialogProps) {
  const [selected, setSelected] = React.useState<UserType | "">("");

  function handleConfirm() {
    if (selected) {
      onSelect(selected as UserType);
      setSelected("");
    }
  }

  function handleClose() {
    setSelected("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} aria-labelledby="user-type-dialog">
      <DialogTitle id="user-type-dialog">¿Cómo vas a utilizar la aplicación?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Selecciona tu perfil para personalizar tu experiencia.
        </Typography>
        <FormControl component="fieldset" fullWidth>
          <RadioGroup
            value={selected}
            onChange={(e) => setSelected(e.target.value as UserType)}
          >
            {USER_TYPE_OPTIONS.map((opt) => (
              <FormControlLabel
                key={opt.value}
                value={opt.value}
                control={<Radio />}
                label={opt.label}
              />
            ))}
          </RadioGroup>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} variant="outlined" color="primary" aria-label="Cancelar">
          Cancelar
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!selected}
          variant="contained"
          color="primary"
          aria-label="Continuar"
        >
          Continuar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
