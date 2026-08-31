import { Button, CircularProgress, Alert, IconButton, Snackbar } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SyncIcon from "@mui/icons-material/Sync";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import styles from "./Convocations.module.css";
import { useState, useMemo } from "react";

import useConvocations from "./hooks/useConvocations";
import useTeamDashboardBack from "../../hooks/useTeamDashboardBack";
import { useIsPlayerRole } from "../../hooks/useIsPlayerRole";
import useEventAttendanceSummaries from "../../hooks/useEventAttendanceSummaries";
import { coachAuthService } from "../../services/authService";
import MatchCard from "./components/MatchCard";
import AgendaList from "./components/AgendaList";
import { DAYS_ES, MONTHS_ES, buildCalendarGrid, toDateKey } from "./helpers/convocationUtils";
import type { NormalizedMatch } from "./types";

// ─── Types ───────────────────────────────────────────────────────────────────

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Convocations() {
  const navigate = useNavigate();
  const location = useLocation();
  const goToTeamDashboard = useTeamDashboardBack();
  const isPlayer = useIsPlayerRole();
  const urlParams = new URLSearchParams(location.search);
  const teamId = urlParams.get("teamId") ?? "";

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const {
    matches,
    loading,
    error,
    federationTeamId,
    settingsLoading,
    syncing,
    syncSnackbar,
    setSyncSnackbar,
    handleSyncCalendar,
  } = useConvocations(teamId || undefined);

  // Build date → matches map
  const matchByDay = useMemo<Record<string, NormalizedMatch[]>>(() => {
    const map: Record<string, NormalizedMatch[]> = {};
    for (const m of matches) {
      if (!m.date) continue;
      if (!map[m.date]) map[m.date] = [];
      map[m.date].push(m);
    }
    return map;
  }, [matches]);

  // Build eventIds for attendance summaries
  const eventIds = useMemo(() =>
    matches.map((m) => m.eventId).filter((id): id is string => !!id),
    [matches]
  );
  const { summaries } = useEventAttendanceSummaries(teamId || undefined, eventIds);

  // Calendar grid for current month
  const calendarGrid = useMemo(() => buildCalendarGrid(year, month), [year, month]);
  const numWeeks = calendarGrid.length;
  const todayKey = toDateKey(today);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const handleMatchClick = (match: NormalizedMatch) => {
    if (match.isFinished) {
      if (match.codacta) {
        navigate(`/federation/acta/${encodeURIComponent(match.codacta)}`);
      }
    } else {
      const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
      navigate(`/coach/convocations/match${qs}`, {
        state: { match },
      });
    }
  };

  const isLoadingAny = settingsLoading || loading;

  const roles = coachAuthService.getRoles();
  const isPlayerFamilyOrFollower =
    (roles.includes("Player") ||
      roles.includes("FamilyPlayer") ||
      roles.includes("FamilyMember") ||
      roles.includes("Follower")) &&
    !roles.includes("Coach") &&
    !roles.includes("Administrator");

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Convocatorias"
        subtitle="Calendario de partidos"
        actionBar={
          <>
            {!isPlayerFamilyOrFollower && (
              <Button
                startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
                onClick={handleSyncCalendar}
                variant="contained"
                size="small"
                disabled={syncing || !federationTeamId}
                title={!federationTeamId ? "Configura tu equipo en Federación para poder generar el calendario" : undefined}
              >
                Generar calendario
              </Button>
            )}
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => goToTeamDashboard()}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>
          </>
        }
      >
        <div className={styles.page}>

          {/* Month navigation */}
          <div className={styles.calendarHeader}>
            <IconButton onClick={prevMonth} size="small" sx={{ color: "rgba(255,255,255,0.7)" }}>
              <ChevronLeftIcon />
            </IconButton>
            <span className={styles.monthTitle}>
              {MONTHS_ES[month]} {year}
            </span>
            <IconButton onClick={nextMonth} size="small" sx={{ color: "rgba(255,255,255,0.7)" }}>
              <ChevronRightIcon />
            </IconButton>
          </div>

        {/* Content area */}
        {isLoadingAny ? (
          <div className={styles.loadingWrapper}>
            <CircularProgress />
          </div>
        ) : error ? (
          <div className={styles.stateWrapper}>
            <Alert severity="warning" sx={{ maxWidth: 400 }}>{error}</Alert>
          </div>
        ) : !teamId ? (
          <div className={styles.stateWrapper}>
            <p className={styles.noSettingsText}>
              No se ha especificado el equipo. Accede desde el panel de entrenador.
            </p>
          </div>
        ) : (
          /* Calendar grid */
          <div
            className={styles.calendarGrid}
            style={{ gridTemplateRows: `auto repeat(${numWeeks}, 1fr)` }}
          >
            {/* Day-of-week headers */}
            {DAYS_ES.map((d) => (
              <div key={d} className={styles.dayHeader}>{d}</div>
            ))}

            {/* Day cells */}
            {calendarGrid.flat().map((date, idx) => {
              if (!date) {
                return <div key={`empty-${idx}`} className={styles.dayCellEmpty} />;
              }
              const key = toDateKey(date);
              const dayMatches = matchByDay[key] ?? [];
              const isToday = key === todayKey;

              return (
                <div
                  key={key}
                  className={`${styles.dayCell}${isToday ? ` ${styles.dayCellToday}` : ""}`}
                >
                  <span className={`${styles.dayNumber}${isToday ? ` ${styles.dayNumberToday}` : ""}`}>
                    {date.getDate()}
                  </span>
                  {/* Desktop: full FC26 cards */}
                  {dayMatches.map((match, mi) => (
                    <MatchCard
                      key={mi}
                      match={match}
                      onNavigate={handleMatchClick}
                      attendanceSummary={match.eventId ? summaries[match.eventId] : undefined}
                      isPlayer={isPlayer}
                    />
                  ))}
                  {/* Mobile: dot indicator */}
                  {dayMatches.length > 0 && (
                    <div className={styles.matchDot} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Mobile agenda list */}
        {!isLoadingAny && !error && teamId && (
          <AgendaList
            matches={matches.filter((m) => {
              const [y, mo] = m.date.split("-").map(Number);
              return y === year && mo - 1 === month;
            })}
            onNavigate={handleMatchClick}
          />
        )}
        </div>
      </ContentLayout>
      <Snackbar
        open={syncSnackbar !== null}
        autoHideDuration={5000}
        onClose={() => setSyncSnackbar(null)}
        message={syncSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </BaseLayout>
  );
}
