import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
  Box,
  Button,
  LinearProgress,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import EmptyState from "../../../../../../shared/components/ui/EmptyState/EmptyState";
import styles from "../../AttendanceSummary.module.css";
import type { PlayerTrainingSummary } from "./types";
import { exportTrainingAttendanceToExcel } from "./trainingAttendanceExcel";
import { coachAuthService } from "../../../../services/authService";

interface Props {
  rows: PlayerTrainingSummary[];
  actionsSlot?: HTMLElement | null;
}

type SortMode = "default" | "lowest" | "name";

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

function rateToneClass(rate: number): string {
  if (rate >= 85) return styles.rateGood;
  if (rate >= 70) return styles.rateMid;
  return styles.rateLow;
}

function absenceDateParts(value: string | null): { day: string; month: string; full: string } {
  const empty = { day: "—", month: "", full: "Fecha no disponible" };
  if (!value) return empty;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return empty;
  return {
    day: new Intl.DateTimeFormat("es-ES", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("es-ES", { month: "short" }).format(date).replace(".", ""),
    full: new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date),
  };
}

function sortRows(rows: PlayerTrainingSummary[], mode: SortMode): PlayerTrainingSummary[] {
  if (mode === "default") return rows;
  const copy = [...rows];
  if (mode === "name") return copy.sort((a, b) => a.playerName.localeCompare(b.playerName, "es"));
  return copy.sort(
    (a, b) => attendanceRate(a) - attendanceRate(b) || a.playerName.localeCompare(b.playerName, "es")
  );
}

export default function AttendanceTrainingsTab({ rows, actionsSlot }: Props) {
  const [exportingExcel, setExportingExcel] = useState(false);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
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

  const normalizedQuery = query.trim().toLowerCase();
  const visibleRows = sortRows(
    rows.filter((row) => row.playerName.toLowerCase().includes(normalizedQuery)),
    sortMode
  );
  const maxPossible = Math.max(...rows.map((row) => row.totalTrainings));
  const teamAverage = Math.round(rows.reduce((sum, row) => sum + attendanceRate(row), 0) / rows.length);

  const toggleSort = (mode: Exclude<SortMode, "default">) =>
    setSortMode((current) => (current === mode ? "default" : mode));

  const toggleExpanded = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportButton = (
    <Button
      variant="contained"
      size={actionsSlot ? "small" : "medium"}
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
  );

  return (
    <Box className={styles.trainingsRoot}>
      <Box className={styles.trainingControls}>
        <label className={styles.trainingSearch}>
          <SearchIcon fontSize="small" aria-hidden="true" />
          <input
            type="text"
            className={styles.trainingSearchInput}
            placeholder="Buscar jugador"
            aria-label="Buscar jugador"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <Box className={styles.trainingSortGroup}>
          <button
            type="button"
            aria-pressed={sortMode === "lowest"}
            className={`${styles.trainingSortButton} ${sortMode === "lowest" ? styles.trainingSortButtonActive : ""}`}
            onClick={() => toggleSort("lowest")}
          >
            Menor asistencia
          </button>
          <button
            type="button"
            aria-pressed={sortMode === "name"}
            className={`${styles.trainingSortButton} ${sortMode === "name" ? styles.trainingSortButtonActive : ""}`}
            onClick={() => toggleSort("name")}
          >
            Nombre
          </button>
        </Box>
        {canExportExcel &&
          (actionsSlot ? (
            createPortal(exportButton, actionsSlot)
          ) : (
            <Box className={styles.trainingToolbar}>{exportButton}</Box>
          ))}
      </Box>

      <Box className={styles.trainingSummaryLine}>
        <span>
          <strong>{rows.length}</strong> jugadores
        </span>
        <span>
          <strong>{maxPossible}</strong> entrenamientos posibles
        </span>
        <span>
          Media del equipo <strong className={styles.trainingAverage}>{teamAverage}%</strong>
        </span>
      </Box>

      {visibleRows.length === 0 && (
        <Typography variant="body2" className={styles.noAbsenceText}>
          Ningún jugador coincide con la búsqueda.
        </Typography>
      )}

      <Box className={styles.trainingCardsGrid}>
        {visibleRows.map((row) => {
          const hasAbsences = row.absences.length > 0;
          const rate = attendanceRate(row);
          const toneClass = rateToneClass(rate);
          const isOpen = expanded.has(row.playerId);

          return (
            <Accordion
              key={row.playerId}
              className={styles.trainingCard}
              disableGutters
              elevation={0}
              expanded={isOpen}
              onChange={() => toggleExpanded(row.playerId)}
              TransitionProps={{ unmountOnExit: true }}
            >
              <AccordionSummary className={styles.trainingCardSummary}>
                <Box className={styles.trainingCardBody}>
                  <Box className={styles.trainingCardHeader}>
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
                    <Box className={styles.trainingIdentityText}>
                      <Typography variant="subtitle1" className={styles.playerName}>
                        {row.playerName}
                      </Typography>
                      <span className={styles.trainingSessions}>
                        {row.attendedTrainings} de {row.totalTrainings} sesiones
                      </span>
                    </Box>
                    <span className={`${styles.trainingRate} ${toneClass}`}>{rate}%</span>
                  </Box>

                  <LinearProgress
                    variant="determinate"
                    value={rate}
                    aria-label={`Asistencia de ${row.playerName}`}
                    className={`${styles.trainingBar} ${toneClass}`}
                  />

                  <Box className={styles.trainingCardFooter}>
                    <span className={styles.trainingAbsentLabel}>{row.absentTrainings} no asistidos</span>
                    <span className={styles.trainingToggle}>
                      {isOpen ? "Ocultar" : "Ver faltas"}
                      <ExpandMoreIcon
                        fontSize="small"
                        className={isOpen ? styles.trainingChevronOpen : styles.trainingChevron}
                      />
                    </span>
                  </Box>
                </Box>
              </AccordionSummary>

              <AccordionDetails className={styles.trainingCardDetails}>
                <Box className={styles.absencePanel}>
                  <Typography variant="subtitle2" className={styles.absencePanelTitle}>
                    No asistencias
                  </Typography>

                  {hasAbsences ? (
                    <ul className={styles.absenceList} aria-label="No asistencias">
                      {row.absences.map((absence, index) => {
                        const parts = absenceDateParts(absence.date);
                        return (
                          <li key={`${absence.eventId}-${index}`} className={styles.absenceItem} title={parts.full}>
                            <span className={styles.absenceDateTile}>
                              <span className={styles.absenceDay}>{parts.day}</span>
                              <span className={styles.absenceMonth}>{parts.month}</span>
                            </span>
                            <span className={styles.absenceText}>
                              <span className={styles.absenceReason}>{absence.reason}</span>
                              <span className={styles.absenceEvent}>{absence.eventTitle}</span>
                            </span>
                          </li>
                        );
                      })}
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
