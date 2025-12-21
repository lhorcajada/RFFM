import React, { useState } from "react";
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import styles from "./EventCard.module.css";
import { SportEventResponse } from "../../services/sportEventService";
import { getEventTypeColor } from "./attendanceUtils";
import { deleteSportEvent } from "../../services/sportEventService";

interface Props {
  event: SportEventResponse;
  eventTypeName?: string | undefined | null;
  onDeleted?: () => void;
}

export default function EventCard({ event, eventTypeName, onDeleted }: Props) {
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  function parseDate(input?: string | number | null): Date | null {
    if (input == null) return null;
    try {
      if (typeof input === "number") {
        const d = new Date(input);
        return isNaN(d.getTime()) ? null : d;
      }
      if (typeof input === "string") {
        const s = input.trim();
        // Handle /Date(123456789)/ (dotnet) timestamps
        const msMatch = s.match(/\/Date\((-?\d+)\)\//);
        if (msMatch) {
          const d = new Date(Number(msMatch[1]));
          if (!isNaN(d.getTime())) return d;
        }
        // Numeric string timestamp
        if (/^-?\d+$/.test(s)) {
          const d = new Date(Number(s));
          if (!isNaN(d.getTime())) return d;
        }
        // Try ISO and common variants
        // If string looks like date only (YYYY-MM-DD), try adding T00:00:00
        let candidate = s;
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) candidate = s + "T00:00:00";
        let d = new Date(candidate);
        if (!isNaN(d.getTime())) return d;
        // Try replacing space with T (e.g. '2025-09-09 19:00:00')
        d = new Date(s.replace(" ", "T"));
        if (!isNaN(d.getTime())) return d;
      }
    } catch (e) {
      // ignore and return null
    }
    return null;
  }
  const rawStart = event.startTime ?? event.start ?? event.eveDateTime ?? null;
  const startDate = parseDate(rawStart ?? undefined);
  const startDateStr = startDate
    ? startDate.toLocaleDateString(undefined, { dateStyle: "medium" })
    : "Fecha no disponible";
  const weekday = startDate
    ? startDate.toLocaleDateString(undefined, { weekday: "long" })
    : null;
  const startTimeStr = startDate
    ? startDate.toLocaleTimeString(undefined, { timeStyle: "short" })
    : "";
  return (
    <div className={styles.card}>
      <div className={styles.titleRow}>
        <div className={styles.title}>{event.title}</div>
        <div style={{ textAlign: "right" }}>
          <div className={styles.meta}>
            {weekday
              ? `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}`
              : ""}
            {weekday ? ", " : ""}
            {startDateStr}
          </div>
          {startTimeStr ? (
            <div className={styles.meta} style={{ fontSize: 12 }}>
              {startTimeStr}
            </div>
          ) : null}
        </div>
      </div>
      {event.location ? (
        <div className={styles.location}>{event.location}</div>
      ) : null}
      {eventTypeName ? (
        <div style={{ marginTop: 6 }}>
          <Chip
            label={eventTypeName}
            size="small"
            sx={{
              backgroundColor: getEventTypeColor(eventTypeName),
              color: "#fff",
            }}
          />
        </div>
      ) : null}
      <div className={styles.actions}>
        <Button
          size="small"
          variant="outlined"
          onClick={() => navigate(String(event.id))}
          aria-label={`Ver asistencias del evento ${event.title}`}
        >
          Ver asistencias
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="error"
          onClick={() => setConfirmOpen(true)}
          sx={{ ml: 1 }}
        >
          Eliminar
        </Button>
      </div>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Eliminar evento</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Desea eliminar el evento "{event.title}"? Esta acción no se puede
            deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancelar</Button>
          <Button
            color="error"
            onClick={async () => {
              setConfirmOpen(false);
              try {
                await deleteSportEvent(String(event.id));
                if (onDeleted) onDeleted();
              } catch (err) {
                // ignore for now
              }
            }}
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
