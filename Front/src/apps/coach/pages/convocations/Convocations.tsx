import { Button, CircularProgress, Alert, IconButton, Snackbar } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SyncIcon from "@mui/icons-material/Sync";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import { calendarService } from "../../../federation/services/Federation";
import { settingsService } from "../../../federation/services/Federation";
import sportEventService, { type SyncMatchItem } from "../../services/sportEventService";
import type { SportEventResponse } from "../../services/sportEventService";
import styles from "./Convocations.module.css";
import { useEffect, useState, useMemo } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type NormalizedMatch = {
  date: string; // "YYYY-MM-DD"
  time: string;
  localTeamName: string;
  localTeamShield: string;
  localGoals: string | null;
  visitorTeamName: string;
  visitorTeamShield: string;
  visitorGoals: string | null;
  isFinished: boolean;
  /** true if the user's team is the local/home team in this match */
  isHomeTeam: boolean;
  field: string;
  codacta: string | null;
  selectedKitNumber: number | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAYS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function normalizeDateStr(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  // ISO: "2024-01-15T..." or "2024-01-15"
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.substring(0, 10);
  // Spanish: "15/01/2024"
  const parts = trimmed.split("/");
  if (parts.length === 3 && parts[0].length <= 2) {
    return `${parts[2].substring(0, 4)}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  return trimmed.substring(0, 10);
}

/** Converts a coach API SportEventResponse to NormalizedMatch for the calendar. */
function normalizeFromSportEvent(ev: SportEventResponse): NormalizedMatch {
  const dateStr = normalizeDateStr(ev.eveDateTime ?? ev.start ?? null);
  const isHomeMatch = ev.isHomeMatch !== false; // default true
  const rivalName = ev.rivalName ?? ev.rival ?? "";
  const rivalPhoto = ev.rivalPhotoUrl ?? "";
  const myTeamName = ev.teamName ?? "";
  const myTeamPhoto = ev.teamPhotoUrl ?? "";

  const localTeamName = isHomeMatch ? myTeamName : rivalName;
  const localTeamShield = isHomeMatch ? myTeamPhoto : rivalPhoto;
  const visitorTeamName = isHomeMatch ? rivalName : myTeamName;
  const visitorTeamShield = isHomeMatch ? rivalPhoto : myTeamPhoto;

  // Extract time from eveDateTime/startTime
  const rawTime = ev.startTime ?? ev.eveDateTime ?? null;
  let time = "";
  if (rawTime && rawTime.includes("T")) {
    const timePart = rawTime.split("T")[1]?.substring(0, 5) ?? "";
    if (timePart !== "00:00") time = timePart;
  }

  const now = new Date();
  const evDate = ev.eveDateTime ? new Date(ev.eveDateTime) : null;
  const isFinished = evDate !== null && evDate < now;

  return {
    date: dateStr,
    time,
    localTeamName,
    localTeamShield,
    localGoals: ev.localGoals ?? null,
    visitorTeamName,
    visitorTeamShield,
    visitorGoals: ev.visitorGoals ?? null,
    isFinished,
    isHomeTeam: isHomeMatch,
    field: ev.location ?? "",
    codacta: ev.codActa ?? null,
    selectedKitNumber: ev.selectedKitNumber ?? null,
  };
}

function resolveIsHomeTeam(match: Record<string, unknown>, teamId?: string | null): boolean {
  if (!teamId) return true;
  const tid = String(teamId).trim().toLowerCase();
  // new API fields
  const localCode = String(match.localTeamCode ?? match.localTeamId ?? "").trim().toLowerCase();
  const visitorCode = String(match.visitorTeamCode ?? match.visitorTeamId ?? "").trim().toLowerCase();
  // legacy API fields
  const localCodeLeg = String(match.codigo_equipo_local ?? match.codigo_local ?? "").trim().toLowerCase();
  const visitorCodeLeg = String(match.codigo_equipo_visitante ?? match.codigo_visitante ?? "").trim().toLowerCase();
  const localName = String(match.localTeamName ?? match.equipo_local ?? "").trim().toLowerCase();
  const visitorName = String(match.visitorTeamName ?? match.equipo_visitante ?? "").trim().toLowerCase();

  const matchesVisitor = [visitorCode, visitorCodeLeg, visitorName].some((v) => v !== "" && v === tid);
  if (matchesVisitor) return false;

  // Explicitly confirm the team is local before returning true
  const matchesLocal = [localCode, localCodeLeg, localName].some((v) => v !== "" && v === tid);
  if (matchesLocal) return true;

  // Fallback: check if the raw match object has any field whose value matches the teamId
  // (handles federation APIs that use non-standard field names)
  const rawValues = Object.values(match).map((v) => String(v ?? "").trim().toLowerCase());
  const inVisitorHalf = rawValues.some(
    (v) => v === tid && Object.keys(match).some((k) =>
      k.toLowerCase().includes("visitor") || k.toLowerCase().includes("visitante")
    )
  );
  if (inVisitorHalf) return false;

  // default to home if truly unknown
  return true;
}

function normalizeRawMatch(
  item: { date: string | null; match: Record<string, unknown> },
  teamId?: string | null,
): NormalizedMatch {
  const m = item.match;
  const rawDate = (m.date ?? m.fecha ?? item.date ?? "") as string;
  const dateStr = normalizeDateStr(rawDate);
  const isHomeTeam = resolveIsHomeTeam(m, teamId);

  // MatchApiMatch format (new API)
  if (m.localTeamName != null || m.localTeamCode != null) {
    const lg = m.localGoals != null ? String(m.localGoals) : null;
    const vg = m.visitorGoals != null ? String(m.visitorGoals) : null;
    const hasScore =
      lg != null && lg !== "" && lg !== "-" &&
      vg != null && vg !== "" && vg !== "-";
    const codacta = m.matchRecordCode != null ? String(m.matchRecordCode) : null;
    return {
      date: dateStr,
      time: (m.time ?? "") as string,
      localTeamName: (m.localTeamName ?? "") as string,
      localTeamShield: (m.localTeamImageUrl ?? "") as string,
      localGoals: lg,
      visitorTeamName: (m.visitorTeamName ?? "") as string,
      visitorTeamShield: (m.visitorTeamImageUrl ?? "") as string,
      visitorGoals: vg,
      isFinished: hasScore,
      isHomeTeam,
      field: (m.field ?? "") as string,
      codacta,
      selectedKitNumber: null,
    };
  }

  // MatchEntry format (legacy API)
  const gC = m.goles_casa != null ? String(m.goles_casa) : null;
  const gV = m.goles_visitante != null ? String(m.goles_visitante) : null;
  const hasScore = gC != null && gC !== "" && gC !== "-";
  const codacta = m.codacta != null ? String(m.codacta) : null;
  return {
    date: dateStr,
    time: (m.hora ?? "") as string,
    localTeamName: (m.equipo_local ?? "") as string,
    localTeamShield: ((m.escudo_equipo_local_url ?? m.escudo_equipo_local) ?? "") as string,
    localGoals: gC,
    visitorTeamName: (m.equipo_visitante ?? "") as string,
    visitorTeamShield: ((m.escudo_equipo_visitante_url ?? m.escudo_equipo_visitante) ?? "") as string,
    visitorGoals: gV,
    isFinished: hasScore,
    isHomeTeam,
    field: (m.campo ?? "") as string,
    codacta,
    selectedKitNumber: null,
  };
}

/** Build calendar grid (Mon-Sun) for a given year/month (0-indexed). */
function buildCalendarGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const startDow = firstDay.getDay(); // 0=Sun
  const offset = startDow === 0 ? 6 : startDow - 1; // shift to Mon=0

  const cells: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= lastDate; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const grid: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) grid.push(cells.slice(i, i + 7));
  return grid;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Agenda list sub-component (mobile) ─────────────────────────────────────────

function AgendaList({ matches, onNavigate }: { matches: NormalizedMatch[]; onNavigate: (match: NormalizedMatch) => void }) {
  const sorted = [...matches].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return null;

  // Group by date
  const groups: { date: string; items: NormalizedMatch[] }[] = [];
  for (const m of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.date === m.date) last.items.push(m);
    else groups.push({ date: m.date, items: [m] });
  }

  const formatDate = (iso: string) => {
    const [y, mo, d] = iso.split("-").map(Number);
    const dt = new Date(y, mo - 1, d);
    return dt.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  };

  return (
    <div className={styles.agendaSection}>
      {groups.map(({ date, items }) => (
        <div key={date} className={styles.agendaGroup}>
          <div className={styles.agendaDateLabel}>{formatDate(date)}</div>
          {items.map((match, i) => (
            <MatchCard key={i} match={match} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Match card sub-component ─────────────────────────────────────────────────

type MatchResult = "won" | "draw" | "lost" | "played" | null;

function getMatchResult(match: NormalizedMatch): MatchResult {
  if (!match.isFinished) return null;
  if (match.localGoals === null || match.visitorGoals === null) return "played";
  const lg = parseInt(match.localGoals, 10);
  const vg = parseInt(match.visitorGoals, 10);
  if (isNaN(lg) || isNaN(vg)) return "played";
  // Determine from the user's team perspective (isHomeTeam = local)
  const myGoals = match.isHomeTeam ? lg : vg;
  const theirGoals = match.isHomeTeam ? vg : lg;
  if (myGoals > theirGoals) return "won";
  if (myGoals === theirGoals) return "draw";
  return "lost";
}

function MatchCard({ match, onNavigate }: { match: NormalizedMatch; onNavigate: (match: NormalizedMatch) => void }) {
  const result = getMatchResult(match);
  const cardClass = [
    styles.matchCard,
    result === "won"  ? styles.matchCardWon  : "",
    result === "draw" ? styles.matchCardDraw : "",
    result === "lost" ? styles.matchCardLost : "",
  ].filter(Boolean).join(" ");

  const statusClass = [
    styles.matchStatus,
    result === "won"    ? styles.matchStatusWon    : "",
    result === "draw"   ? styles.matchStatusDraw   : "",
    result === "lost"   ? styles.matchStatusLost   : "",
    result === "played" ? styles.matchStatusPlayed : "",
  ].filter(Boolean).join(" ");

  const statusLabel =
    result === "won"  ? "Victoria" :
    result === "draw" ? "Empate"   :
    result === "lost" ? "Derrota"  :
    "Finalizado";

  return (
    <div
      className={cardClass}
      onClick={() => onNavigate(match)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onNavigate(match)}
    >
      <div className={styles.matchCardInner}>
        {/* Local team */}
        <div className={styles.matchTeamBlock}>
          {match.localTeamShield ? (
            <img
              src={match.localTeamShield}
              alt=""
              className={styles.matchTeamShield}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className={styles.matchTeamShieldPlaceholder} />
          )}
          <span className={styles.matchTeamName}>{match.localTeamName || "—"}</span>
        </div>

        {/* Score / time center block */}
        <div className={styles.matchScoreBlock}>
          {match.isFinished ? (
            <>
              {match.localGoals !== null && match.visitorGoals !== null ? (
                <span className={styles.matchScoreValue}>
                  {match.localGoals}
                  <span className={styles.matchScoreDash}>-</span>
                  {match.visitorGoals}
                </span>
              ) : null}
              <span className={statusClass}>{statusLabel}</span>
            </>
          ) : (
            <>
              <span className={styles.matchTimePlanned}>{match.time || "--:--"}</span>
              <span className={styles.matchTimeLabel}>kick-off</span>
            </>
          )}
        </div>

        {/* Visitor team */}
        <div className={styles.matchTeamBlock}>
          {match.visitorTeamShield ? (
            <img
              src={match.visitorTeamShield}
              alt=""
              className={styles.matchTeamShield}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className={styles.matchTeamShieldPlaceholder} />
          )}
          <span className={styles.matchTeamName}>{match.visitorTeamName || "—"}</span>
        </div>
      </div>

      {/* Field footer */}
      {match.field && (
        <div className={styles.matchField}>{match.field}</div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Convocations() {
  const navigate = useNavigate();
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const teamId = urlParams.get("teamId") ?? "";

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const [matches, setMatches] = useState<NormalizedMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [federationTeamId, setFederationTeamId] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncSnackbar, setSyncSnackbar] = useState<string | null>(null);

  // Load federation settings → get the federation team ID
  useEffect(() => {
    let mounted = true;
    setSettingsLoading(true);
    (async () => {
      try {
        const settings = await settingsService.getSettings();
        if (!mounted) return;
        const primary = settings.find((s) => s.isPrimary) ?? settings[0] ?? null;
        setFederationTeamId(primary?.teamId ?? null);
      } catch {
        if (mounted) setFederationTeamId(null);
      } finally {
        if (mounted) setSettingsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load sport events from coach API (primary calendar source)
  const loadCoachEvents = (mounted: { current: boolean }) => {
    if (!teamId) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        // Iterate all pages to avoid missing events beyond the first page
        const pageSize = 200;
        let pageNumber = 1;
        const allItems: SportEventResponse[] = [];
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const result = await sportEventService.getSportEvents(teamId, pageNumber, pageSize);
          allItems.push(...result.items);
          if (pageNumber >= result.totalPages || result.items.length < pageSize) break;
          pageNumber++;
        }
        if (!mounted.current) return;
        const matchEvents = allItems.filter(
          (ev) => (ev.eventTypeId ?? 0) === 1 || (ev.eventType ?? "").toLowerCase().includes("partido")
        );
        setMatches(matchEvents.map(normalizeFromSportEvent));
      } catch {
        if (mounted.current) setError("No se pudo cargar el calendario de partidos.");
      } finally {
        if (mounted.current) setLoading(false);
      }
    })();
  };

  useEffect(() => {
    if (settingsLoading) return;
    const mounted = { current: true };
    loadCoachEvents(mounted);
    return () => { mounted.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, settingsLoading]);

  // Sync calendar from federation on demand
  const handleSyncCalendar = async () => {
    if (!federationTeamId || !teamId || syncing) return;
    setSyncing(true);
    try {
      const raw = await calendarService.getTeamMatches(federationTeamId) as Array<{ date: string | null; match: Record<string, unknown> }>;

      // Extract own team shield from the first available match
      let myTeamShieldUrl: string | null = null;
      for (const item of raw) {
        const normalized = normalizeRawMatch(item, federationTeamId);
        const shield = normalized.isHomeTeam ? normalized.localTeamShield : normalized.visitorTeamShield;
        if (shield) { myTeamShieldUrl = shield; break; }
      }

      const syncItems: SyncMatchItem[] = raw
        .reduce<SyncMatchItem[]>((acc, item) => {
          const normalized = normalizeRawMatch(item, federationTeamId);
          if (!normalized.date) return acc;
          const rivalName = normalized.isHomeTeam
            ? normalized.visitorTeamName
            : normalized.localTeamName;
          const rivalShieldUrl = normalized.isHomeTeam
            ? normalized.visitorTeamShield
            : normalized.localTeamShield;
          acc.push({
            rivalName: rivalName || "Rival desconocido",
            rivalShieldUrl: rivalShieldUrl || null,
            matchDate: normalized.date,
            matchTime: normalized.time || null,
            field: normalized.field || null,
            isHomeMatch: normalized.isHomeTeam,
            codActa: normalized.codacta ?? null,
            localGoals: normalized.localGoals,
            visitorGoals: normalized.visitorGoals,
          });
          return acc;
        }, []);

      if (syncItems.length === 0) {
        setSyncSnackbar("No se encontraron partidos en el calendario de federación.");
        return;
      }

      const result = await sportEventService.syncCalendarFromFederation({ teamId, matches: syncItems, myTeamShieldUrl });
      const failedMsg = result.failed > 0 ? `, ${result.failed} con error` : "";
      setSyncSnackbar(`Calendario sincronizado: ${result.created} creados, ${result.updated} actualizados${failedMsg}.`);

      // Reload coach events
      const mounted = { current: true };
      loadCoachEvents(mounted);
    } catch {
      setSyncSnackbar("Error al sincronizar el calendario. Intenta de nuevo.");
    } finally {
      setSyncing(false);
    }
  };

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
      // Not started / in progress → convocation detail
      const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
      navigate(`/coach/convocations/match${qs}`, {
        state: { match },
      });
    }
  };

  const isLoadingAny = settingsLoading || loading;

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Convocatorias"
        subtitle="Calendario de partidos"
        actionBar={
          <>
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
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate("/coach/dashboard")}
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
                    <MatchCard key={mi} match={match} onNavigate={handleMatchClick} />
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
