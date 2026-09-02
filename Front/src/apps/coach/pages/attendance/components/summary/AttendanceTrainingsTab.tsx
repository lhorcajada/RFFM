import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
  Box,
  Button,
  Chip,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { useMemo, useState } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import EmptyState from "../../../../../../shared/components/ui/EmptyState/EmptyState";
import styles from "../../AttendanceSummary.module.css";
import type { PlayerTrainingSummary } from "./types";
import { exportTrainingAttendanceToExcel } from "./trainingAttendanceExcel";
import { coachAuthService } from "../../../../services/authService";

interface Props {
  rows: PlayerTrainingSummary[];
}

function isGoalkeeperPosition(position?: string | null): boolean {
  const p = (position ?? "").toLowerCase();
  return p.includes("portero") || p.includes("keeper") || p.includes("arquero");
}

function playerInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function attendanceRate(row: PlayerTrainingSummary): number {
  if (row.totalTrainings === 0) return 0;
  return Math.round((row.attendedTrainings / row.totalTrainings) * 100);
}

function formatDate(value: string | null): string {
  if (!value) return "Fecha no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default function AttendanceTrainingsTab({ rows }: Props) {
  const [exportingExcel, setExportingExcel] = useState(false);
  const roles = useMemo(
    () => coachAuthService.getRoles().map((role) => role.toLowerCase()),
    []
  );
  const canExportExcel = !roles.some((role) =>
    ["player", "familyplayer", "familymember"].includes(role)
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Sin datos de entrenamientos"
        description="No hay convocatorias de entrenamientos para construir el resumen por jugador."
      />
    );
  }

  return (
    <Box>
      {canExportExcel && (
        <Box className={styles.trainingToolbar}>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            disabled={exportingExcel}
            onClick={async () => {
              try {
                setExportingExcel(true);
                await exportTrainingAttendanceToExcel(rows);
              } finally {
                setExportingExcel(false);
              }
            }}
          >
            {exportingExcel ? "Generando Excel..." : "Exportar Excel"}
          </Button>
        </Box>
      )}

      <Box className={styles.trainingCardsGrid}>
        {rows.map((row) => {
          const hasAbsences = row.absences.length > 0;

          return (
            <Accordion key={row.playerId} className={styles.trainingCard} disableGutters elevation={0}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} className={styles.trainingCardSummary}>
                <Box className={styles.trainingCardHeader}>
                  <Box className={styles.trainingCardIdentity}>
                    <Box className={styles.matchCardAvatarWrap}>
                      <Avatar
                        src={row.photoUrl ?? undefined}
                        alt={row.playerName}
                        className={styles.trainingCardAvatar}
                      >
                        {playerInitials(row.playerName)}
                      </Avatar>
                      {row.dorsal != null && (
                        <span className={styles.matchDorsalBadge} title={`Dorsal ${row.dorsal}`}>
                          <svg
                            viewBox="0 0 24 24"
                            className={`${styles.matchDorsalJersey} ${
                              isGoalkeeperPosition(row.position) ? styles.matchDorsalJerseyKeeper : ""
                            }`}
                            aria-hidden="true"
                          >
                            <path d="M8.5 2 L4 4.5 L2 8 L4.5 9.8 L6 8 L6 21 L18 21 L18 8 L19.5 9.8 L22 8 L20 4.5 L15.5 2 C15.5 3.4 13.9 4.5 12 4.5 C10.1 4.5 8.5 3.4 8.5 2 Z" />
                          </svg>
                          <span className={styles.matchDorsalNumber}>{row.dorsal}</span>
                        </span>
                      )}
                    </Box>
                    <Typography variant="subtitle1" className={styles.playerName}>
                      {row.playerName}
                    </Typography>
                  </Box>

                  <Box className={styles.trainingMetrics}>
                    <Chip label={`${row.totalTrainings} posibles`} size="small" className={styles.metricChip} />
                    <Chip label={`${row.attendedTrainings} asistidos`} size="small" className={styles.metricChipSuccess} />
                    <Chip label={`${row.absentTrainings} no asistidos`} size="small" className={styles.metricChipWarn} />
                    <Chip label={`${attendanceRate(row)}% asistencia`} size="small" className={styles.metricChipSuccess} />
                  </Box>
                </Box>
              </AccordionSummary>

              <AccordionDetails className={styles.trainingCardDetails}>
                <Box className={styles.absencePanel}>
                  <Typography variant="subtitle2" className={styles.absencePanelTitle}>
                    No asistencias
                  </Typography>

                  {hasAbsences ? (
                    <ul className={styles.absenceList}>
                      {row.absences.map((absence, index) => (
                        <li key={`${absence.eventId}-${index}`} className={styles.absenceItem}>
                          <span className={styles.absenceDate}>{formatDate(absence.date)}</span>
                          <span className={styles.absenceSeparator}>·</span>
                          <span className={styles.absenceReason}>{absence.reason}</span>
                          <span className={styles.absenceEvent}>{absence.eventTitle}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Typography variant="body2" className={styles.noAbsenceText}>
                      Sin ausencias registradas
                    </Typography>
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>
    </Box>
  );
}
