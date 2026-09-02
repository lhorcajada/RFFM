import { useState, useEffect } from "react";
import {
  Button,
  Checkbox,
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
import rivalService, { Rival } from "../../../services/rivalService";
import FileImagePicker from "../../../../../shared/components/ui/FileImagePicker/FileImagePicker";
import styles from "./SportEventDialog.module.css";

type RivalMode = "none" | "existing" | "new";

interface Props {
  open: boolean;
  teamId: string;
  event?: SportEventResponse | null;
  onClose: () => void;
  onSaved: (event?: SportEventResponse) => void;
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
  const [locationMapUrl, setLocationMapUrl] = useState("");
  const [description, setDescription] = useState("");

  const [rivalMode, setRivalMode] = useState<RivalMode>("none");
  const [rivalId, setRivalId] = useState<string>("");
  const [newRivalName, setNewRivalName] = useState("");
  const [newRivalPhotoFile, setNewRivalPhotoFile] = useState<File | null>(null);
  const [newRivalCategory, setNewRivalCategory] = useState("");
  const [isHomeMatch, setIsHomeMatch] = useState<boolean>(true);

  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] =
    useState<"daily" | "weekly" | "monthly">("weekly");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");

  const [eventTypes, setEventTypes] = useState<SportEventType[]>([]);
  const [rivals, setRivals] = useState<Rival[]>([]);
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
      setLocationMapUrl(event.locationMapUrl ?? "");
      setDescription(event.description ?? "");
      setRivalId(event.rivalId ?? "");
      setRivalMode(event.rivalId ? "existing" : "none");
      setIsHomeMatch(event.isHomeMatch !== false);
    } else {
      setName("");
      setEventTypeId("");
      // No default date/time — the event can be scheduled later
      setEveDateTime("");
      setEndTime("");
      setLocation("");
      setLocationMapUrl("");
      setDescription("");
      setRivalId("");
      setRivalMode("none");
      setIsHomeMatch(true);
    }
    setNewRivalName("");
    setNewRivalPhotoFile(null);
    setNewRivalCategory("");
    setIsRecurring(false);
    setRecurrenceFrequency("weekly");
    setRecurrenceEndDate("");
    setError(null);
  }, [open, event]);

  // Recurrence needs an anchor date — turn it off if the date is cleared
  useEffect(() => {
    if (!eveDateTime && isRecurring) {
      setIsRecurring(false);
    }
  }, [eveDateTime, isRecurring]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!eventTypeId) {
      setError("El tipo de evento es obligatorio.");
      return;
    }
    if (isRecurring) {
      if (!eveDateTime) {
        setError("La recurrencia requiere una fecha de evento.");
        return;
      }
      if (!recurrenceEndDate) {
        setError("La fecha final de la recurrencia es obligatoria.");
        return;
      }
      const eventDateOnly = eveDateTime.slice(0, 10);
      if (recurrenceEndDate <= eventDateOnly) {
        setError(
          "La fecha final de la recurrencia debe ser posterior a la fecha del evento."
        );
        return;
      }
    }
    if (isMatchType && rivalMode === "new" && !newRivalName.trim()) {
      setError("El nombre del rival nuevo es obligatorio.");
      return;
    }
    if (locationMapUrl.trim()) {
      try {
        new URL(locationMapUrl.trim());
      } catch {
        setError(
          "El enlace de ubicación debe ser una URL válida (debe empezar por http:// o https://)."
        );
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      let newRivalUrlPhoto: string | null = null;
      if (isMatchType && rivalMode === "new" && newRivalPhotoFile) {
        const uploadResp = await rivalService.uploadRivalPhoto(newRivalPhotoFile);
        newRivalUrlPhoto =
          uploadResp?.Url ?? uploadResp?.url ?? uploadResp?.UrlPhoto ?? null;
      }

      const payload: SportEventPayload = {
        name: name.trim(),
        eveDateTime: eveDateTime ? toUtcIso(eveDateTime) : null,
        startTime: eveDateTime ? toUtcIso(eveDateTime) : null,
        endTime: endTime ? toUtcIso(endTime) : null,
        location: location || null,
        locationMapUrl: locationMapUrl.trim() || null,
        description: description || null,
        eventTypeId: Number(eventTypeId),
        teamId,
        rivalId: isMatchType && rivalMode === "existing" ? rivalId || null : null,
        newRival:
          isMatchType && rivalMode === "new"
            ? {
                name: newRivalName.trim(),
                urlPhoto: newRivalUrlPhoto,
                category: newRivalCategory.trim() || null,
              }
            : null,
        isHomeMatch: isMatchType ? isHomeMatch : undefined,
        recurrence: isRecurring
          ? { frequency: recurrenceFrequency, endDate: recurrenceEndDate }
          : undefined,
      };

      let savedEvent: SportEventResponse | undefined;
      if (isEdit && event) {
        const { teamId: _tid, ...updatePayload } = payload;
        savedEvent = await sportEventService.updateSportEvent(String(event.id), updatePayload);
      } else {
        savedEvent = await sportEventService.createSportEvent(payload);
      }
      onSaved(savedEvent);
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
          label="Fecha y hora (opcional)"
          type="datetime-local"
          fullWidth
          size="small"
          InputLabelProps={{ shrink: true }}
          value={eveDateTime}
          onChange={(e) => setEveDateTime(e.target.value)}
          sx={{ mb: 2 }}
          helperText="Puedes dejarla en blanco y completarla más adelante editando el evento."
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
        <FormControlLabel
          control={
            <Checkbox
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              disabled={!eveDateTime}
              size="small"
            />
          }
          label="¿Es recurrente?"
          sx={{ mb: !eveDateTime ? 0 : 1 }}
        />
        {!eveDateTime && (
          <div className={styles.hint}>
            Añade una fecha para poder configurar la recurrencia.
          </div>
        )}
        {isRecurring && (
          <>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel id="recurrence-frequency-label">Frecuencia</InputLabel>
              <Select
                labelId="recurrence-frequency-label"
                label="Frecuencia"
                value={recurrenceFrequency}
                onChange={(e) =>
                  setRecurrenceFrequency(
                    e.target.value as "daily" | "weekly" | "monthly"
                  )
                }
              >
                <MenuItem value="daily">Diaria</MenuItem>
                <MenuItem value="weekly">Semanal</MenuItem>
                <MenuItem value="monthly">Mensual</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Fecha final de la recurrencia"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={recurrenceEndDate}
              onChange={(e) => setRecurrenceEndDate(e.target.value)}
              sx={{ mb: 2 }}
              required
            />
          </>
        )}
        {isMatchType && (
          <>
            <FormControl sx={{ mb: 1 }} fullWidth>
              <RadioGroup
                row
                value={rivalMode}
                onChange={(e) => setRivalMode(e.target.value as RivalMode)}
              >
                <FormControlLabel value="none" control={<Radio size="small" />} label="Sin rival" />
                <FormControlLabel
                  value="existing"
                  control={<Radio size="small" />}
                  label="Rival existente"
                />
                <FormControlLabel value="new" control={<Radio size="small" />} label="Rival nuevo" />
              </RadioGroup>
            </FormControl>
            {rivalMode === "existing" && (
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel id="rival-label">Rival</InputLabel>
                <Select
                  labelId="rival-label"
                  label="Rival"
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
            {rivalMode === "new" && (
              <>
                <TextField
                  label="Nombre del rival"
                  fullWidth
                  size="small"
                  value={newRivalName}
                  onChange={(e) => setNewRivalName(e.target.value)}
                  sx={{ mb: 2 }}
                  required
                />
                <div className={styles.rivalPhotoField}>
                  <FileImagePicker
                    id="new-rival-photo"
                    label="Escudo/foto del rival (opcional)"
                    file={newRivalPhotoFile}
                    onChange={setNewRivalPhotoFile}
                  />
                </div>
                <TextField
                  label="Categoría del rival (opcional)"
                  fullWidth
                  size="small"
                  value={newRivalCategory}
                  onChange={(e) => setNewRivalCategory(e.target.value)}
                  sx={{ mb: 2 }}
                />
              </>
            )}
          </>
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
          label="Enlace de Google Maps (opcional)"
          type="url"
          fullWidth
          size="small"
          value={locationMapUrl}
          onChange={(e) => setLocationMapUrl(e.target.value)}
          sx={{ mb: 2 }}
          placeholder="https://maps.google.com/..."
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
