import { useState } from "react";
import { Button, Popover, TextField } from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import styles from "./EventsFilterBar.module.css";

export type EventsSegment = "upcoming" | "past" | "season";
export type EventTypeFilter = "match" | "training" | "tournament";

const SEGMENTS: { value: EventsSegment; label: string }[] = [
  { value: "upcoming", label: "Próximos" },
  { value: "past", label: "Pasados" },
  { value: "season", label: "Toda la temporada" },
];

const TYPES: { value: EventTypeFilter; label: string }[] = [
  { value: "match", label: "Partidos" },
  { value: "training", label: "Entrenamientos" },
  { value: "tournament", label: "Torneos" },
];

interface Props {
  segment: EventsSegment | null;
  activeTypes: EventTypeFilter[];
  startDate: string | null;
  endDate: string | null;
  onSegmentChange: (segment: EventsSegment) => void;
  onToggleType: (type: EventTypeFilter) => void;
  onApplyRange: (start: string | null, end: string | null) => void;
}

export default function EventsFilterBar({
  segment,
  activeTypes,
  startDate,
  endDate,
  onSegmentChange,
  onToggleType,
  onApplyRange,
}: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [draftStart, setDraftStart] = useState(startDate ?? "");
  const [draftEnd, setDraftEnd] = useState(endDate ?? "");

  function openRange(target: HTMLElement) {
    setDraftStart(startDate ?? "");
    setDraftEnd(endDate ?? "");
    setAnchor(target);
  }

  function applyRange() {
    onApplyRange(draftStart || null, draftEnd || null);
    setAnchor(null);
  }

  return (
    <div className={styles.bar}>
      <div className={styles.segments} role="group" aria-label="Periodo">
        {SEGMENTS.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-pressed={segment === s.value}
            className={`${styles.segment} ${segment === s.value ? styles.segmentActive : ""}`}
            onClick={() => onSegmentChange(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className={styles.types} role="group" aria-label="Tipo de evento">
        {TYPES.map((t) => {
          const active = activeTypes.includes(t.value);
          return (
            <button
              key={t.value}
              type="button"
              aria-pressed={active}
              className={`${styles.chip} ${active ? styles.chipActive : ""}`}
              onClick={() => onToggleType(t.value)}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={styles.rangeButton}
        aria-label="Fechas"
        aria-haspopup="dialog"
        onClick={(e) => openRange(e.currentTarget)}
      >
        <CalendarMonthIcon fontSize="small" aria-hidden />
        <span>{startDate && endDate ? `${startDate} – ${endDate}` : "Fechas"}</span>
      </button>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <div className={styles.popover}>
          <TextField
            label="Desde"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={draftStart}
            onChange={(e) => setDraftStart(e.target.value)}
          />
          <TextField
            label="Hasta"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={draftEnd}
            onChange={(e) => setDraftEnd(e.target.value)}
          />
          <Button variant="contained" size="small" onClick={applyRange}>
            Aplicar
          </Button>
        </div>
      </Popover>
    </div>
  );
}
