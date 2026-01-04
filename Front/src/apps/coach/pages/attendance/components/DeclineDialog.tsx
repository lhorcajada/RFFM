import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  MenuItem,
  Select,
} from "@mui/material";
import type { ExcuseType } from "../../services/excuseTypeService";

type Props = {
  open: boolean;
  onClose: () => void;
  excuseTypes: ExcuseType[];
  onAccept: (excuseTypeId?: number | null) => void;
};

export default function DeclineDialog({
  open,
  onClose,
  excuseTypes,
  onAccept,
}: Props) {
  const [value, setValue] = React.useState<string | number | "">("");
  React.useEffect(() => {
    if (!open) setValue("");
  }, [open]);
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Seleccionar justificante</DialogTitle>
      <DialogContent>
        <Select
          fullWidth
          value={value}
          onChange={(e) => setValue(e.target.value)}
        >
          <MenuItem value="">Seleccione</MenuItem>
          {excuseTypes.map((ex) => (
            <MenuItem key={ex.id} value={ex.id}>
              {ex.name} {ex.justified ? "(Justificado)" : ""}
            </MenuItem>
          ))}
        </Select>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          onClick={() => {
            onAccept(value === "" ? null : Number(value));
            onClose();
          }}
          variant="contained"
        >
          Aceptar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
