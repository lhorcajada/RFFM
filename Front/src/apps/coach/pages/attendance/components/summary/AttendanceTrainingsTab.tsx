import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { useState } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import EmptyState from "../../../../../../shared/components/ui/EmptyState/EmptyState";
import styles from "../../AttendanceSummary.module.css";
import type { PlayerTrainingSummary } from "./types";
import { exportTrainingAttendanceToExcel } from "./trainingAttendanceExcel";

interface Props {
  rows: PlayerTrainingSummary[];
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

      <Box className={styles.trainingCardsGrid}>
        {rows.map((row) => {
          const hasAbsences = row.absences.length > 0;

          return (
            <Accordion key={row.playerId} className={styles.trainingCard} disableGutters elevation={0}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} className={styles.trainingCardSummary}>
                <Box className={styles.trainingCardHeader}>
                  <Box>
                    <Typography variant="subtitle1" className={styles.playerName}>
                      {row.playerName}
                    </Typography>
                  </Box>

                  <Box className={styles.trainingMetrics}>
                    <Chip label={`${row.totalTrainings} totales`} size="small" className={styles.metricChip} />
                    <Chip label={`${row.attendedTrainings} asistidos`} size="small" className={styles.metricChipSuccess} />
                    <Chip label={`${row.absentTrainings} no asistidos`} size="small" className={styles.metricChipWarn} />
                    <Chip label={`${row.pendingTrainings} pendientes`} size="small" className={styles.metricChipMuted} />
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
