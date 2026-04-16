import { useState, useEffect } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  TextField,
} from "@mui/material";
import sportEventService, {
  SportEventResponse,
  SportEventPayload,
} from "../../../services/sportEventService";
import sportEventTypeService, {
  SportEventType,
} from "../../../services/sportEventTypeService";
import rivalService, { RivalResponse } from "../../../services/rivalService";
import styles from "./SportEventDialog.module.css";

interface Props {
  open: boolean;
  teamId: string;
  event?: SportEventResponse | null;
  onClose: () => void;
  onSaved: () => void;
}

function toLocalDateTimeInput(iso?: string | null): string {
  if (!iso) return "";
  // Convert ISO UTC string to local datetime-local input value (YYYY-MM-DDTHH:MM)
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toUtcIso(localValue: string): string {
  if (!localValue) return "";
  // datetime-local input gives YYYY-MM-DDTHH:MM — treat as local time, convert to UTC ISO
  return new Date(localValue).toISOString();
}

export default function SportEventDialog({
  open,
  teamId,
  event,
  onClose,
  onSaved,
}: Props) {
  const isEdit = !!event;

  const [name, setName] = useState("");
  const [eventTypeId, setEventTypeId] = useState<number | "">("");
  const [eveDateTime, setEveDateTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  const [rivalId, setRivalId] = useState<string>("");
  const [isHomeMatch, setIsHomeMatch] = useState<boolean>(true);

  const [eventTypes, setEventTypes] = useState<SportEventType[]>([]);
  const [rivals, setRivals] = useState<RivalResponse[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [loadingRivals, setLoadingRivals] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMatchType =
    eventTypeId !== "" &&
    eventTypes.find((t) => t.id === eventTypeId) !== undefined &&
    ["partido", "amistoso"].some((kw) =>
      eventTypes
        .find((t) => t.id === eventTypeId)
        ?.name.toLowerCase()
        .includes(kw)
    );

  // Load event types and rivals once
  useEffect(() => {
    if (!open) return;
    setLoadingTypes(true);
    sportEventTypeService
      .getSportEventTypes()
      .then((types) => setEventTypes(types))
      .catch(() => setEventTypes([]))
      .finally(() => setLoadingTypes(false));
    setLoadingRivals(true);
    rivalService
      .getRivals()
      .then((r) => setRivals(r))
      .catch(() => setRivals([]))
      .finally(() => setLoadingRivals(false));
  }, [open]);

  // Populate form when editing
  useEffect(() => {
    if (!open) return;
    if (event) {
      setName(event.name ?? event.title ?? "");
      setEventTypeId(event.eventTypeId ?? "");
      const rawStart =
        event.startTime ?? event.eveDateTime ?? event.start ?? null;
      setEveDateTime(toLocalDateTimeInput(rawStart));
      setEndTime(toLocalDateTimeInput(event.endTime));
      setLocation(event.location ?? "");
      setDescription(event.description ?? "");
      setRivalId(event.rivalId ?? "");
      setIsHomeMatch(event.isHomeMatch !== false);
    } else {
      setName("");
      setEventTypeId("");
      // Default to today at 10:00
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setEveDateTime(
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T10:00`
      );
      setEndTime("");
      setLocation("");
      setDescription("");
      setRivalId("");
      setIsHomeMatch(true);
    }
    setError(null);
  }, [open, event]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!eveDateTime) {
      setError("La fecha/hora del evento es obligatoria.");
      return;
    }
    if (!eventTypeId) {
      setError("El tipo de evento es obligatorio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: SportEventPayload = {
        name: name.trim(),
        eveDateTime: toUtcIso(eveDateTime),
        startTime: toUtcIso(eveDateTime),
        endTime: endTime ? toUtcIso(endTime) : null,
        location: location || null,
        description: description || null,
        eventTypeId: Number(eventTypeId),
        teamId,
        rivalId: isMatchType ? (rivalId || null) : null,
        isHomeMatch: isMatchType ? isHomeMatch : undefined,
      };

      if (isEdit && event) {
        const { teamId: _tid, ...updatePayload } = payload;
        await sportEventService.updateSportEvent(String(event.id), updatePayload);
      } else {
        await sportEventService.createSportEvent(payload);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ className: styles.paper }}
    >
      <DialogTitle className={styles.title}>
        {isEdit ? "Editar evento" : "Nuevo evento"}
      </DialogTitle>
      <DialogContent className={styles.content}>
        <TextField
          label="Nombre"
          fullWidth
          size="small"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mt: 1, mb: 2 }}
          required
        />
        <FormControl fullWidth size="small" sx={{ mb: 2 }} required>
          <InputLabel id="event-type-label">Tipo de evento</InputLabel>
          <Select
            labelId="event-type-label"
            label="Tipo de evento"
            value={eventTypeId}
            onChange={(e) => setEventTypeId(e.target.value as number)}
            disabled={loadingTypes}
          >
            {loadingTypes ? (
              <MenuItem disabled>
                <CircularProgress size={16} sx={{ mr: 1 }} /> Cargando...
              </MenuItem>
            ) : (
              eventTypes.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))
            )}
          </Select>
        </FormControl>
        <TextField
          label="Fecha y hora"
          type="datetime-local"
          fullWidth
          size="small"
          InputLabelProps={{ shrink: true }}
          value={eveDateTime}
          onChange={(e) => setEveDateTime(e.target.value)}
          sx={{ mb: 2 }}
          required
        />
        <TextField
          label="Hora de fin (opcional)"
          type="datetime-local"
          fullWidth
          size="small"
          InputLabelProps={{ shrink: true }}
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          sx={{ mb: 2 }}
        />
        {isMatchType && (
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel id="rival-label">Rival (opcional)</InputLabel>
            <Select
              labelId="rival-label"
              label="Rival (opcional)"
              value={rivalId}
              onChange={(e) => setRivalId(e.target.value as string)}
              disabled={loadingRivals}
            >
              <MenuItem value="">— Sin rival —</MenuItem>
              {loadingRivals ? (
                <MenuItem disabled>
                  <CircularProgress size={16} sx={{ mr: 1 }} /> Cargando...
                </MenuItem>
              ) : (
                rivals.map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    {r.name}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        )}
        {isMatchType && (
          <FormControl sx={{ mb: 2 }} fullWidth>
            <RadioGroup
              row
              value={isHomeMatch ? "home" : "away"}
              onChange={(e) => setIsHomeMatch(e.target.value === "home")}
            >
              <FormControlLabel value="home" control={<Radio size="small" />} label="🏠 Local" />
              <FormControlLabel value="away" control={<Radio size="small" />} label="✈️ Visitante" />
            </RadioGroup>
          </FormControl>
        )}
        <TextField
          label="Ubicación (opcional)"
          fullWidth
          size="small"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          label="Descripción (opcional)"
          fullWidth
          size="small"
          multiline
          minRows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {error && (
          <div className={styles.error}>{error}</div>
        )}
      </DialogContent>
      <DialogActions className={styles.actions}>
        <Button onClick={onClose} variant="outlined" size="small" disabled={saving}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          size="small"
          disabled={saving}
        >
          {saving ? <CircularProgress size={18} /> : isEdit ? "Guardar" : "Crear"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
