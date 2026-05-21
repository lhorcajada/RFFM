import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  createTrialDay,
  deleteTrialDay,
  getTrialDays,
  updateTrialDay,
  type SeasonAccessTrialDay,
} from "../../../services/seasonAccessService";
import styles from "./TrialDaysManager.module.css";

interface Props {
  seasonId: string;
  category: string;
}

interface DayFormState {
  date: string;
  label: string;
}

const emptyForm = (): DayFormState => ({
  date: new Date().toISOString().slice(0, 10),
  label: "",
});

export default function TrialDaysManager({ seasonId, category }: Props) {
  const [days, setDays] = useState<SeasonAccessTrialDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDay, setEditingDay] = useState<SeasonAccessTrialDay | null>(null);
  const [form, setForm] = useState<DayFormState>(emptyForm());

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    getTrialDays(seasonId, category)
      .then((result: SeasonAccessTrialDay[]) => {
        if (mounted) setDays(result);
      })
      .catch(() => {
        if (mounted) setError("No se pudieron cargar los días de prueba.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [seasonId, category]);

  function openCreate() {
    setEditingDay(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(day: SeasonAccessTrialDay) {
    setEditingDay(day);
    setForm({ date: day.date, label: day.label ?? "" });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingDay(null);
  }

  async function handleSave() {
    if (!form.date) return;
    setSaving(true);
    setError(null);

    try {
      if (editingDay) {
        const updated = await updateTrialDay(editingDay.id, {
          date: form.date,
          label: form.label || null,
        });
        setDays((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d)).sort((a, b) => a.date.localeCompare(b.date)),
        );
      } else {
        const created = await createTrialDay({
          seasonId,
          category,
          date: form.date,
          label: form.label || null,
        });
        setDays((prev) => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)));
      }
      closeDialog();
    } catch {
      setError("No se pudo guardar el día de prueba.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    setError(null);
    try {
      await deleteTrialDay(id);
      setDays((prev) => prev.filter((d) => d.id !== id));
    } catch {
      setError("No se pudo eliminar el día de prueba.");
    } finally {
      setSaving(false);
      setDeleteConfirmId(null);
    }
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr + "T00:00:00").toLocaleDateString("es-ES", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Typography variant="subtitle2" className={styles.title}>
          Días de prueba
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={openCreate}
          disabled={saving}
        >
          Añadir día
        </Button>
      </div>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
          <CircularProgress size={20} />
        </Box>
      )}

      {error && (
        <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
          {error}
        </Typography>
      )}

      {!loading && days.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          No hay días de prueba. Añade el primer día para poder registrar valoraciones.
        </Typography>
      )}

      {days.length > 0 && (
        <ul className={styles.dayList}>
          {days.map((day) => (
            <li key={day.id} className={styles.dayItem}>
              <div className={styles.dayInfo}>
                <Typography variant="body2" className={styles.dayDate}>
                  {formatDate(day.date)}
                </Typography>
                {day.label && (
                  <Typography variant="caption" color="text.secondary">
                    {day.label}
                  </Typography>
                )}
              </div>
              <div className={styles.dayActions}>
                <Tooltip title="Editar">
                  <IconButton size="small" onClick={() => openEdit(day)} disabled={saving}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Eliminar">
                  <IconButton size="small" onClick={() => setDeleteConfirmId(day.id)} disabled={saving} color="error">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{editingDay ? "Editar día de prueba" : "Nuevo día de prueba"}</DialogTitle>
        <DialogContent>
          <TextField
            label="Fecha"
            type="date"
            fullWidth
            margin="normal"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Descripción (opcional)"
            fullWidth
            margin="normal"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder="Ej: Mañana / Tarde / Campo A"
            inputProps={{ maxLength: 200 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={saving || !form.date}>
            {saving ? <CircularProgress size={16} /> : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmId !== null} onClose={() => setDeleteConfirmId(null)} maxWidth="xs">
        <DialogTitle>Eliminar día de prueba</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Seguro que quieres eliminar este día? Se borrarán también todas las valoraciones registradas para ese día.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmId(null)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={saving}
            onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
          >
            {saving ? <CircularProgress size={16} /> : "Eliminar"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
