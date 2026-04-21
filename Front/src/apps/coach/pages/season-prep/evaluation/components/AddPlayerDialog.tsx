import { useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import styles from "../EvaluationPage.module.css";

interface AddPlayerDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (p: { name: string; procedencia: string; birthYear: number; position: string }) => void;
  positionOptions: string[];
  existingNames: string[];
}

export function AddPlayerDialog({ open, onClose, onConfirm, positionOptions, existingNames }: AddPlayerDialogProps) {
  const [name, setName] = useState("");
  const [procedencia, setProcedencia] = useState("");
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [position, setPosition] = useState("");

  const isDuplicate = name.trim().length > 0 &&
    existingNames.some((n) => n.trim().toLowerCase() === name.trim().toLowerCase());

  function reset() {
    setName(""); setProcedencia(""); setBirthYear(null); setPosition("");
  }

  function handleClose() { reset(); onClose(); }

  function handleConfirm() {
    if (!name.trim() || !birthYear) return;
    onConfirm({ name: name.trim(), procedencia: procedencia.trim(), birthYear, position: position.trim() });
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Añadir jugador</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Nombre"
            size="small"
            fullWidth
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={isDuplicate}
            helperText={isDuplicate ? "Ya existe un jugador con ese nombre" : undefined}
          />
          <TextField
            label="Procedencia"
            size="small"
            fullWidth
            placeholder="Club o equipo de origen"
            value={procedencia}
            onChange={(e) => setProcedencia(e.target.value)}
          />
          <Box>
            <Typography variant="caption" sx={{ opacity: 0.6, mb: 0.5, display: "block" }}>
              Año de nacimiento
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              {[2011, 2012].map((y) => (
                <button
                  key={y}
                  className={`${styles.yearBtn} ${birthYear === y ? styles.yearBtnActive : ""}`}
                  onClick={() => setBirthYear(y)}
                >
                  {y}
                </button>
              ))}
            </Box>
          </Box>
          <Autocomplete
            freeSolo
            size="small"
            options={positionOptions}
            value={position}
            onInputChange={(_e, v) => setPosition(v)}
            onChange={(_e, v) => setPosition(v ?? "")}
            renderInput={(params) => (
              <TextField {...params} label="Posición" placeholder="Ej. Centrocampista" />
            )}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancelar</Button>
        <Button variant="contained" disabled={!name.trim() || !birthYear || isDuplicate} onClick={handleConfirm}>
          Añadir
        </Button>
      </DialogActions>
    </Dialog>
  );
}
