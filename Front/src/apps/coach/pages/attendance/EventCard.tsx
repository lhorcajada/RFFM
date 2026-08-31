import React, { useState } from "react";
import {
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
  IconButton,
  Tooltip,
} from "@mui/material";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import { useNavigate } from "react-router-dom";
import styles from "./EventCard.module.css";
import { SportEventResponse } from "../../services/sportEventService";
import { deleteSportEvent } from "../../services/sportEventService";
import SportEventDialog from "./components/SportEventDialog";
import { coachAuthService } from "../../services/authService";
import { EventAttendanceBadges } from "../../components/EventAttendanceBadges/EventAttendanceBadges";
import type { EventAttendanceSummaryDto } from "../../services/eventAttendanceSummaryService";
import type { MatchState } from "../convocations/components/convocationMatchDetail.types";

/** Build a MatchState (expected by ConvocationMatchDetail) from a SportEventResponse */
function toMatchState(ev: SportEventResponse): MatchState {
  const raw = ev.eveDateTime ?? ev.startTime ?? ev.start ?? null;
  const date = raw ? raw.trim().substring(0, 10) : "";

  let time = "";
  if (raw && raw.includes("T")) {
    const part = raw.split("T")[1]?.substring(0, 5) ?? "";
    if (part !== "00:00") time = part;
  }

  const isHomeMatch = ev.isHomeMatch !== false;
  const rivalName = ev.rivalName ?? ev.rival ?? "";
  const rivalShield = ev.rivalPhotoUrl ?? "";
  const myTeamName = ev.teamName ?? "";
  const myTeamShield = ev.teamPhotoUrl ?? "";

  return {
    date,
    time,
    localTeamName: isHomeMatch ? myTeamName : rivalName,
    localTeamShield: isHomeMatch ? myTeamShield : rivalShield,
    visitorTeamName: isHomeMatch ? rivalName : myTeamName,
    visitorTeamShield: isHomeMatch ? rivalShield : myTeamShield,
    isFinished: raw ? new Date(raw) < new Date() : false,
    isHomeTeam: isHomeMatch,
    field: ev.location ?? "",
    codacta: ev.codActa ?? null,
    selectedKitNumber: ev.selectedKitNumber ?? null,
  };
}

interface Props {
  event: SportEventResponse;
  eventTypeName?: string | undefined | null;
  onDeleted?: () => void;
  onEdited?: () => void;
  attendanceSummary?: EventAttendanceSummaryDto;
  isPlayer?: boolean;
  /**
   * Read-only mode for contexts that only show the card (e.g. the dashboard's
   * "Próximos eventos" widget), not the full Attendance list. Hides the
   * Asistencias/Editar/Eliminar/"Ir al partido" action icons and both
   * dialogs — the "Asistencias" button's `navigate(String(event.id))` is a
   * *relative* navigation that only resolves correctly when EventCard is
   * mounted under `/coach/attendance`; anywhere else it would navigate to
   * the wrong route. Edit/delete also don't belong in a compact preview.
   */
  compact?: boolean;
}

function getEventAvatar(eventTypeName?: string | null): { emoji: string; gradient: string } {
  const name = (eventTypeName ?? "").toLowerCase();
  if (name.includes("entrenamiento")) {
    return {
      emoji: "⚽",
      gradient: "linear-gradient(135deg, #1b5e20 0%, #2e7d32 50%, #145214 100%)",
    };
  }
  if (name.includes("torneo") || name.includes("competici")) {
    return {
      emoji: "🏆",
      gradient: "linear-gradient(135deg, #b71c1c 0%, #c62828 50%, #9c1515 100%)",
    };
  }
  return {
    emoji: "📅",
    gradient: "linear-gradient(135deg, #37474f 0%, #455a64 50%, #2c3e50 100%)",
  };
}

type MatchResult = "won" | "draw" | "lost" | null;
function getMatchResult(event: SportEventResponse): MatchResult {
  const lg = event.localGoals;
  const vg = event.visitorGoals;
  if (lg == null || lg === "" || vg == null || vg === "") return null;
  const lNum = parseInt(lg, 10);
  const vNum = parseInt(vg, 10);
  if (isNaN(lNum) || isNaN(vNum)) return null;
  const isHome = event.isHomeMatch !== false;
  const myGoals = isHome ? lNum : vNum;
  const theirGoals = isHome ? vNum : lNum;
  if (myGoals > theirGoals) return "won";
  if (myGoals === theirGoals) return "draw";
  return "lost";
}

function ShieldImg({ src, alt }: { src: string; alt: string }) {
  const [hidden, setHidden] = useState(false);
  if (!src || hidden) return <div className={styles.matchShieldPlaceholder} />;
  return (
    <img
      src={src}
      alt={alt}
      className={styles.matchShield}
      onError={() => setHidden(true)}
    />
  );
}

function parseDate(input?: string | number | null): Date | null {
  if (input == null) return null;
  try {
    if (typeof input === "number") {
      const d = new Date(input);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof input === "string") {
      const s = input.trim();
      const msMatch = s.match(/\/Date\((-?\d+)\)\//);
      if (msMatch) {
        const d = new Date(Number(msMatch[1]));
        if (!isNaN(d.getTime())) return d;
      }
      if (/^-?\d+$/.test(s)) {
        const d = new Date(Number(s));
        if (!isNaN(d.getTime())) return d;
      }
      let candidate = s;
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) candidate = s + "T00:00:00";
      let d = new Date(candidate);
      if (!isNaN(d.getTime())) return d;
      d = new Date(s.replace(" ", "T"));
      if (!isNaN(d.getTime())) return d;
    }
  } catch {
    // ignore
  }
  return null;
}

export default function EventCard({ event, eventTypeName, onDeleted, onEdited, attendanceSummary, isPlayer, compact }: Props) {
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const canEditEvent =
    coachAuthService.hasRole("Administrator") ||
    coachAuthService.hasRole("Coach") ||
    coachAuthService.hasRole("ClubDirector") ||
    coachAuthService.hasRole("ClubMember");

  const rawStart = event.startTime ?? event.start ?? event.eveDateTime ?? null;
  const startDate = parseDate(rawStart ?? undefined);
  const startDateStr = startDate
    ? startDate.toLocaleDateString("es-ES", { dateStyle: "medium" })
    : "Por confirmar";
  const weekday = startDate
    ? startDate.toLocaleDateString("es-ES", { weekday: "long" })
    : null;
  const startTimeStr = startDate
    ? startDate.toLocaleTimeString("es-ES", { timeStyle: "short" })
    : "";
  const dateLabel = [
    weekday ? `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}` : "",
    startDateStr,
  ]
    .filter(Boolean)
    .join(", ");

  const isMatch = (eventTypeName ?? "").toLowerCase().includes("partido");
  const isTraining = (eventTypeName ?? "").toLowerCase().includes("entrenamiento");

  const arrivalDate = parseDate(event.arrivalDate ?? event.arrival ?? undefined);
  const arrivalTimeStr = arrivalDate
    ? arrivalDate.toLocaleTimeString("es-ES", { timeStyle: "short" })
    : "";

  // Match-specific derived data
  // isHomeMatch: true = user's team plays at home; false = away; null/undefined = unknown
  const isHome = event.isHomeMatch === true;
  const isAway = event.isHomeMatch === false;
  const myTeamName = event.teamName ?? "";
  const myTeamShield = event.teamPhotoUrl ?? "";
  const rivalName = event.rivalName ?? "";
  const rivalShield = event.rivalPhotoUrl ?? "";
  const hasScore =
    event.localGoals != null && event.localGoals !== "" &&
    event.visitorGoals != null && event.visitorGoals !== "";

  // When away: rival is the local team (left), user is visitor (right).
  // Score in DB is always local-visitor, so positions match automatically.
  const leftTeamName = isAway ? rivalName : myTeamName;
  const leftShield = isAway ? rivalShield : myTeamShield;
  const rightTeamName = isAway ? myTeamName : rivalName;
  const rightShield = isAway ? myTeamShield : rivalShield;
  // localGoals always belongs to the left team, visitorGoals to the right
  const leftGoals = event.localGoals;
  const rightGoals = event.visitorGoals;

  const matchResult = isMatch ? getMatchResult(event) : null;
  const resultLabel =
    matchResult === "won" ? "Victoria" :
    matchResult === "draw" ? "Empate" :
    matchResult === "lost" ? "Derrota" : null;

  const avatar = getEventAvatar(eventTypeName);

  const actions = (
    <div className={styles.actions}>
      {isMatch ? (
        <Tooltip title="Ir al partido">
          <IconButton
            size="small"
            onClick={() => {
              const teamIdParam = encodeURIComponent(String(event.teamId ?? ""));
              navigate(`/coach/convocations/match?teamId=${teamIdParam}`, { state: { match: toMatchState(event) } });
            }}
            aria-label={`Ir al partido ${event.title}`}
            sx={{ color: "rgba(180,195,240,0.85)" }}
          >
            <SportsSoccerIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : null}
      <Tooltip title="Asistencias">
        <IconButton
          size="small"
          onClick={() => navigate(String(event.id))}
          aria-label={`Ver asistencias del evento ${event.title}`}
          sx={{ color: "rgba(180,195,240,0.85)" }}
        >
          <PeopleAltIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {canEditEvent && (
        <Tooltip title="Editar">
          <IconButton
            size="small"
            onClick={() => setEditOpen(true)}
            aria-label="Editar evento"
            sx={{ color: "rgba(180,195,240,0.85)" }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {canEditEvent && (
        <Tooltip title="Eliminar">
          <IconButton
            size="small"
            onClick={() => setConfirmOpen(true)}
            aria-label="Eliminar evento"
            sx={{ color: "rgba(230,100,100,0.85)" }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </div>
  );

  return (
    <div
      className={`${styles.card} ${isMatch ? styles.cardMatch : ""} ${
        isTraining
          ? event.hasConvokedPlayers
            ? styles.cardConvocationOpen
            : styles.cardConvocationPending
          : ""
      }`}
    >
      {/* ── MATCH HEADER ─────────────────────────────── */}
      {isMatch ? (
        <div className={styles.matchHeader}>
          <div className={styles.matchHeaderShine} />
          {/* Home/Away badge */}
          {isHome && <span className={styles.homeBadge}>🏠 Local</span>}
          {isAway && <span className={`${styles.homeBadge} ${styles.awayBadge}`}>✈️ Visitante</span>}
          <div className={styles.matchTeamBlock}>
            <ShieldImg src={leftShield} alt={leftTeamName} />
            <span className={styles.matchTeamName} title={leftTeamName}>
              {leftTeamName || (isAway ? "Rival" : "Mi equipo")}
            </span>
          </div>
          <div className={styles.matchCenter}>
            {hasScore ? (
              <span className={styles.matchScore}>
                {leftGoals}
                <span className={styles.matchScoreDash}>-</span>
                {rightGoals}
              </span>
            ) : (
              <>
                <span className={styles.matchVs}>vs</span>
                {startTimeStr && (
                  <span className={styles.matchKickoff}>{startTimeStr}</span>
                )}
              </>
            )}
            {resultLabel && (
              <span
                className={`${styles.matchResultBadge} ${
                  matchResult === "won" ? styles.resultWon :
                  matchResult === "draw" ? styles.resultDraw :
                  styles.resultLost
                }`}
              >
                {resultLabel}
              </span>
            )}
          </div>
          <div className={`${styles.matchTeamBlock} ${styles.matchTeamRight}`}>
            <ShieldImg src={rightShield} alt={rightTeamName} />
            <span className={styles.matchTeamName} title={rightTeamName}>
              {rightTeamName || (isAway ? "Mi equipo" : "Rival")}
            </span>
          </div>
        </div>
      ) : (
        /* ── GENERIC HEADER ──────────────────────────── */
        <div className={styles.header} style={{ background: avatar.gradient }}>
          <div className={styles.headerShine} />
          <div className={styles.avatar}>{avatar.emoji}</div>
          {eventTypeName && (
            <Chip
              label={eventTypeName}
              size="small"
              sx={{
                backgroundColor: "rgba(255,255,255,0.18)",
                color: "#fff",
                fontWeight: 700,
                fontSize: "0.7rem",
                height: 22,
                backdropFilter: "blur(4px)",
              }}
            />
          )}
        </div>
      )}

      {/* ── BODY ─────────────────────────────────────── */}
      <div className={styles.body}>
        <div className={styles.title} title={event.title}>{event.title}</div>
        <div className={styles.metaRow}>
          <span className={styles.meta}>{dateLabel}</span>
          {startTimeStr && !hasScore && !isMatch && (
            <span className={styles.metaTime}>{startTimeStr}</span>
          )}
        </div>
        {event.location && (
          <div className={styles.location} title={event.location}>
            📍 {event.location}
          </div>
        )}
        {!isMatch && event.rivalName && (
          <div className={styles.rival} title={event.rivalName}>
            <span className={styles.rivalLabel}>Rival:</span> {event.rivalName}
          </div>
        )}
        {event.name && event.name !== event.title && (
          <div className={styles.eventName} title={event.name}>{event.name}</div>
        )}
        {isMatch && (
          <div style={{ marginTop: 4 }}>
            <Chip
              label="Partido"
              size="small"
              sx={{
                backgroundColor: "rgba(13,71,161,0.45)",
                color: "#90caf9",
                fontWeight: 700,
                fontSize: "0.68rem",
                height: 20,
              }}
            />
          </div>
        )}
        {isTraining && (
          <div style={{ marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {arrivalTimeStr && (
              <Chip
                label={`Llegada ${arrivalTimeStr}`}
                size="small"
                sx={{
                  backgroundColor: "rgba(255,193,7,0.22)",
                  color: "#ffd54f",
                  fontWeight: 700,
                  fontSize: "0.7rem",
                  height: 20,
                }}
              />
            )}
            <Chip
              label={event.hasConvokedPlayers ? "Convocatoria abierta" : "Convocatoria sin iniciar"}
              size="small"
              sx={{
                backgroundColor: event.hasConvokedPlayers ? "rgba(46,125,50,0.35)" : "rgba(120,130,150,0.3)",
                color: event.hasConvokedPlayers ? "#a5d6a7" : "#cfd8dc",
                fontWeight: 700,
                fontSize: "0.68rem",
                height: 20,
              }}
            />
          </div>
        )}
        <EventAttendanceBadges summary={attendanceSummary} isPlayer={!!isPlayer} />
      </div>

      {!compact && actions}

      {!compact && canEditEvent && (
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
                } catch (err: any) {
                  const status = err?.response?.status;
                  if (status === 404) {
                    alert("El evento ya no existe. Se actualizará el listado.");
                    if (onDeleted) onDeleted();
                  } else {
                    alert(err?.response?.data?.detail ?? err?.message ?? "Error al eliminar el evento.");
                  }
                }
              }}
            >
              Eliminar
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {!compact && event.teamId && canEditEvent && (
        <SportEventDialog
          open={editOpen}
          teamId={event.teamId}
          event={event}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            if (onEdited) onEdited();
          }}
        />
      )}
    </div>
  );
}
