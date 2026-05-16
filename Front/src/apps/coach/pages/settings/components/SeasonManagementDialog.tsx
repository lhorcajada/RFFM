import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import seasonService, { Season } from "../../../services/seasonService";
import styles from "./SeasonManagementDialog.module.css";

interface SeasonFormState {
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface SeasonManagementDialogProps {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
  clubId: string;
}

function toInputDate(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function buildDefaultForm(): SeasonFormState {
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);

  return {
    name: "",
    startDate: toInputDate(startDate.toISOString()),
    endDate: toInputDate(endDate.toISOString()),
    isActive: true,
  };
}

function seasonToForm(season: Season): SeasonFormState {
  return {
    name: season.name ?? "",
    startDate: toInputDate(season.startDate),
    endDate: toInputDate(season.endDate),
    isActive: season.active ?? season.isActive ?? false,
  };
}

function toIsoDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as {
    response?: { data?: { detail?: string; title?: string; message?: string } };
    message?: string;
  };

  return (
    anyError?.response?.data?.detail ??
    anyError?.response?.data?.title ??
    anyError?.response?.data?.message ??
    anyError?.message ??
    fallback
  );
}

export default function SeasonManagementDialog({ open, onClose, onChanged, clubId }: SeasonManagementDialogProps) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [form, setForm] = useState<SeasonFormState>(buildDefaultForm());
  const [deleteTarget, setDeleteTarget] = useState<Season | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!clubId) {
      setSeasons([]);
      setSelectedSeasonId("");
      setForm(buildDefaultForm());
      setError("Selecciona un club para cargar las temporadas.");
      return;
    }

    void loadSeasons();
  }, [clubId, open]);

  const loadSeasons = async () => {
    setLoading(true);
    setError(null);
    try {
      const allSeasons = await seasonService.getSeasons(clubId);
      setSeasons(allSeasons);

      if (allSeasons.length === 0) {
        setSelectedSeasonId("");
        setForm(buildDefaultForm());
        return;
      }

      const activeSeason =
        allSeasons.find((season) => season.active ?? season.isActive) ?? allSeasons[0];
      setSelectedSeasonId(activeSeason.id);
      setForm(seasonToForm(activeSeason));
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "No se han podido cargar las temporadas."));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSeason = (season: Season) => {
    setSelectedSeasonId(season.id);
    setForm(seasonToForm(season));
    setError(null);
  };

  const handleNewSeason = () => {
    setSelectedSeasonId("");
    setForm(buildDefaultForm());
    setError(null);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name || !form.startDate || !form.endDate) {
      return;
    }
    if (form.endDate < form.startDate) {
      setError("La fecha fin no puede ser anterior a la fecha de inicio.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const startDate = toIsoDate(form.startDate);
      const endDate = toIsoDate(form.endDate);

      if (selectedSeasonId) {
        await seasonService.updateSeason(selectedSeasonId, name, form.isActive, startDate, endDate);
      } else {
        await seasonService.createSeason(name, form.isActive, startDate, endDate, clubId);
      }

      await loadSeasons();
      onChanged?.();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "No se ha podido guardar la temporada."));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleteLoading(true);
    setError(null);
    try {
      await seasonService.deleteSeason(deleteTarget.id);
      setDeleteTarget(null);
      await loadSeasons();
      onChanged?.();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "No se ha podido eliminar la temporada."));
    } finally {
      setDeleteLoading(false);
    }
  };

  const selectedSeason = seasons.find((season) => season.id === selectedSeasonId);

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>Gestión de temporadas</DialogTitle>
        <DialogContent className={styles.dialogContent}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" className={styles.helperText}>
              Solo puede existir una temporada activa. Si eliminas una temporada con datos asociados, el sistema bloqueará la acción.
            </Typography>

            {error && <div className={styles.errorBox}>{error}</div>}

            <div className={styles.layout}>
              <div className={styles.panel}>
                <div className={styles.listHeader}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Todas las temporadas
                  </Typography>
                  <Button startIcon={<AddIcon />} size="small" variant="outlined" onClick={handleNewSeason}>
                    Nueva temporada
                  </Button>
                </div>

                <div className={styles.listWrap}>
                  {loading ? (
                    <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 180 }}>
                      <CircularProgress size={28} />
                    </Stack>
                  ) : seasons.length === 0 ? (
                    <div className={styles.emptyState}>
                      Todavía no hay temporadas creadas.
                    </div>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Nombre</TableCell>
                          <TableCell>Inicio</TableCell>
                          <TableCell>Fin</TableCell>
                          <TableCell>Estado</TableCell>
                          <TableCell align="right">Acciones</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {seasons.map((season) => {
                          const isSelected = season.id === selectedSeasonId;
                          const isActive = season.active ?? season.isActive ?? false;
                          return (
                            <TableRow key={season.id} selected={isSelected} hover>
                              <TableCell>{season.name ?? season.id}</TableCell>
                              <TableCell>{toInputDate(season.startDate) || "-"}</TableCell>
                              <TableCell>{toInputDate(season.endDate) || "-"}</TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={isActive ? "Activa" : "Inactiva"}
                                  color={isActive ? "success" : "default"}
                                  variant={isActive ? "filled" : "outlined"}
                                  className={styles.statusChip}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                  <IconButton size="small" onClick={() => handleSelectSeason(season)} aria-label="Editar temporada">
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton size="small" color="error" onClick={() => setDeleteTarget(season)} aria-label="Eliminar temporada">
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>

              <div className={styles.panel}>
                <Typography variant="subtitle1" fontWeight={700}>
                  {selectedSeason ? "Editar temporada" : "Crear temporada"}
                </Typography>

                <div className={styles.formGrid}>
                  <TextField
                    className={styles.fullWidth}
                    label="Nombre"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    size="small"
                    inputProps={{ maxLength: 200 }}
                  />
                  <TextField
                    label="Fecha de inicio"
                    type="date"
                    value={form.startDate}
                    onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="Fecha de fin"
                    type="date"
                    value={form.endDate}
                    onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                  <div className={styles.fullWidth}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={form.isActive}
                          onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                        />
                      }
                      label="Marcar como activa"
                    />
                  </div>
                </div>

                <Typography variant="body2" className={styles.helperText}>
                  {selectedSeason
                    ? `Estás editando ${selectedSeason.name ?? selectedSeason.id}.`
                    : "Completa el formulario para crear una nueva temporada."}
                </Typography>

                <div className={styles.actionButtons}>
                  <Button onClick={handleNewSeason} variant="outlined" size="small">
                    Limpiar
                  </Button>
                  <Button onClick={handleSave} variant="contained" size="small" disabled={saving || !form.name.trim()}>
                    {saving ? <CircularProgress size={16} color="inherit" /> : selectedSeason ? "Guardar cambios" : "Crear temporada"}
                  </Button>
                </div>
              </div>
            </div>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving || deleteLoading}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar temporada</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Quieres eliminar {deleteTarget?.name ?? "esta temporada"}? Si tiene datos relacionados, la operación se bloqueará.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>
            Cancelar
          </Button>
          <Button onClick={handleDeleteConfirmed} variant="contained" color="error" disabled={deleteLoading}>
            {deleteLoading ? <CircularProgress size={16} color="inherit" /> : "Eliminar"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
