import { useEffect, useMemo, useState } from "react";
import { Alert, Autocomplete, Box, Button, Chip, Stack, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

import { getSportEvents, type SportEventResponse } from "../../../services/sportEventService";
import SportEventDialog from "../../attendance/components/SportEventDialog";

export interface SeasonPrepEventPickerProps {
  teamId?: string | null;
  teamName?: string | null;
  value: SportEventResponse | null;
  onChange: (event: SportEventResponse | null) => void;
}

function formatEventDate(event: SportEventResponse): string {
  const raw = event.startTime ?? event.eveDateTime ?? event.start ?? null;
  if (!raw) return "Fecha no disponible";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return date.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
}

function getEventTitle(event: SportEventResponse): string {
  return event.name?.trim() || event.title?.trim() || "Evento sin nombre";
}

export default function SeasonPrepEventPicker({ teamId, teamName, value, onChange }: SeasonPrepEventPickerProps) {
  const [events, setEvents] = useState<SportEventResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!teamId) {
      setEvents([]);
      return;
    }

    let active = true;
    setLoading(true);
    getSportEvents(teamId, 1, 100)
      .then((result) => {
        if (!active) return;
        setEvents((result.items ?? []).slice().sort((a, b) => {
          const aTime = new Date(a.startTime ?? a.eveDateTime ?? a.start ?? 0).getTime();
          const bTime = new Date(b.startTime ?? b.eveDateTime ?? b.start ?? 0).getTime();
          return bTime - aTime;
        }));
      })
      .catch(() => {
        if (!active) return;
        setEvents([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [teamId]);

  const selected = useMemo(() => {
    if (!value) return null;
    return events.find((event) => event.id === value.id) ?? value;
  }, [events, value]);

  if (!teamId) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        No se ha podido determinar el equipo. Vuelve a la pantalla anterior y abre la evaluación desde un equipo cargado.
      </Alert>
    );
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Autocomplete
            options={events}
            value={selected}
            loading={loading}
            onChange={(_, next) => onChange(next)}
            getOptionLabel={(option) => `${getEventTitle(option)} · ${formatEventDate(option)}`}
            isOptionEqualToValue={(option, current) => option.id === current.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Evento"
                placeholder="Busca o selecciona un evento"
                size="small"
                helperText={teamName ? `Equipo: ${teamName}` : "Selecciona un evento del equipo"}
              />
            )}
          />
        </Box>

        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
          disabled={!teamId}
        >
          Crear evento
        </Button>
      </Stack>

      {selected ? (
        <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap" }} alignItems="center">
          <Chip size="small" color="primary" label={getEventTitle(selected)} />
          <Chip size="small" variant="outlined" label={formatEventDate(selected)} />
          {selected.eventType ? <Chip size="small" variant="outlined" label={selected.eventType} /> : null}
          {selected.location ? <Typography variant="body2" sx={{ opacity: 0.72 }}>{selected.location}</Typography> : null}
        </Stack>
      ) : (
        <Typography variant="body2" sx={{ mt: 1.5, opacity: 0.65 }}>
          Selecciona un evento para cargar la evaluación y las pruebas.
        </Typography>
      )}

      <SportEventDialog
        open={createOpen}
        teamId={teamId}
        onClose={() => setCreateOpen(false)}
        onSaved={(event) => {
          setCreateOpen(false);
          if (event) {
            setEvents((current) => {
              const next = [event, ...current.filter((item) => item.id !== event.id)];
              return next.slice().sort((a, b) => {
                const aTime = new Date(a.startTime ?? a.eveDateTime ?? a.start ?? 0).getTime();
                const bTime = new Date(b.startTime ?? b.eveDateTime ?? b.start ?? 0).getTime();
                return bTime - aTime;
              });
            });
            onChange(event);
          }
        }}
      />
    </Box>
  );
}
