import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import type { ExcuseType } from "../../../services/excuseTypeService";

type Props = {
  open: boolean;
  excuseTypes: ExcuseType[];
  value: number | "";
  onClose: () => void;
  onChange: (value: number) => void;
  onConfirm: () => void;
};

export default function ConvocationDeconvokeDialog({
  open,
  excuseTypes,
  value,
  onClose,
  onChange,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Motivo de desconvocatoria</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mt: 1 }}>
          <InputLabel id="deconvoke-reason-label">Motivo</InputLabel>
          <Select
            labelId="deconvoke-reason-label"
            label="Motivo"
            value={value}
            onChange={(e) => onChange(e.target.value as number)}
          >
            {excuseTypes.map((et) => (
              <MenuItem key={et.id} value={et.id}>
                {et.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" disabled={!value} onClick={onConfirm}>
          Desconvocar
        </Button>
      </DialogActions>
    </Dialog>
  );
}