import React from "react";
import styles from "./ActaHeaderDate.module.css";
import { Typography } from "@mui/material";

function formatDateHuman(dateStr?: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.getDate();
  const month = d.toLocaleString("es-ES", { month: "long" });
  const year = d.getFullYear();
  return `${day} de ${month} ${year}`;
}

function pickDateFromSource(src: any): string | null {
  if (!src) return null;
  // Common fields
  const candidates = [
    src?.fecha,
    src?.date,
    src?.fecha_partido,
    src?.fecha_completa,
    src?.rawDate,
    src?.parsedDate && typeof src.parsedDate === "string"
      ? src.parsedDate
      : null,
    src?.parsedDate instanceof Date
      ? (src.parsedDate as Date).toISOString()
      : null,
  ];
  for (const c of candidates) {
    if (c) {
      const n = normalizeDateString(String(c));
      if (n) return n;
    }
  }
  // Try combined fecha + hora
  if (src?.fecha && src?.hora) {
    const n = normalizeDateString(`${src.fecha} ${src.hora}`);
    if (n) return n;
  }
  // Try top-level object keys with date-like values
  for (const k of Object.keys(src || {})) {
    const v = src[k];
    if (!v) continue;
    if (typeof v === "string") {
      const n = normalizeDateString(v);
      if (n) return n;
    }
  }
  return null;
}

// Try to normalize a date-like string into an ISO string
function normalizeDateString(s?: string | null): string | null {
  if (!s) return null;
  const t = String(s).trim();
  // ISO-like
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t;
  // dd/mm/yyyy or dd-mm-yyyy
  const m1 = t.match(
    /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}:\d{2}))?/
  );
  if (m1) {
    const dd = Number(m1[1]);
    const mm = Number(m1[2]) - 1;
    const yyyy = Number(m1[3]);
    const hhmm = m1[4] ? m1[4] : "00:00";
    const d = new Date(
      yyyy,
      mm,
      dd,
      Number(hhmm.split(":")[0]),
      Number(hhmm.split(":")[1])
    );
    return d.toISOString();
  }
  // Spanish long form '25 de septiembre 2025' -> try Date parser
  const d2 = new Date(t);
  if (!Number.isNaN(d2.getTime())) return d2.toISOString();
  return null;
}

export default function ActaHeaderDate({
  source,
}: {
  source?: any;
}): JSX.Element | null {
  const raw = pickDateFromSource(source ?? null);
  const h = formatDateHuman(raw ?? null);
  if (!h) return null;
  return (
    <div className={styles.root}>
      <Typography className={styles.text} variant="h6">
        Acta de partido {h}
      </Typography>
    </div>
  );
}
