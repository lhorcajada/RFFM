import { useEffect, useMemo, useState } from "react";
import { Alert } from "@mui/material";
import { useLiveMatchServerState } from "../hooks/useLiveMatchServerState";
import { useFinishedMatchReport } from "../hooks/useFinishedMatchReport";
import { computeElapsedSeconds } from "../utils/liveMatchClock";
import type { LiveMatchReport, MatchReport } from "../../../services/matchReportService";
import LiveMatchSubstitutions from "./LiveMatchSubstitutions";
import LiveMatchScoreboard from "./simulation/LiveMatchScoreboard";
import GoalTimeline from "./simulation/GoalTimeline";
import CardsTimeline from "./simulation/CardsTimeline";
import type { CardEvent, GoalEvent, LiveMatchPhase } from "./simulation/liveMatch.types";
import styles from "./LiveMatchViewer.module.css";

type Props = {
  eventId: string;
  localTeamName: string;
  localTeamShield?: string | null;
  visitorTeamName: string;
  visitorTeamShield?: string | null;
};

function parseJsonArray<T>(json: string | null): T[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function phaseBadge(phase: LiveMatchPhase): string {
  if (phase === "preMatch") return "ANTES";
  if (phase === "halftime") return "DESCANSO";
  if (phase === "finished") return "FIN";
  return phase === "secondHalf" ? "2ª" : "1ª";
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function reportGoalsToEvents(live: LiveMatchReport): GoalEvent[] {
  return live.goals.map((g, i) => ({
    id: `report-goal-${i}`,
    minute: g.minute,
    scorerId: null,
    scorerName: g.scorerName,
    scorerDorsal: g.scorerDorsal,
    isOwnTeam: g.isOwnTeam,
    scoreAtMoment: { local: g.scoreLocal, visitor: g.scoreVisitor },
    pitchZone: null,
    bodyPart: null,
  }));
}

function reportCardsToEvents(live: LiveMatchReport): CardEvent[] {
  return live.cards.map((c, i) => ({
    id: `report-card-${i}`,
    minute: c.minute,
    half: c.half === 2 ? 2 : 1,
    cardType: c.cardType,
    teamPlayerId: null,
    playerName: c.playerName,
    isRivalPlayer: c.isRivalPlayer,
    rivalDorsal: c.rivalDorsal,
  }));
}

function parseScore(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Marcador final del informe: el del último gol live si existe; si no, el resultado guardado. */
function reportScore(report: MatchReport): { local: number; visitor: number } | null {
  const lastGoal = report.live?.goals[report.live.goals.length - 1];
  if (lastGoal) return { local: lastGoal.scoreLocal, visitor: lastGoal.scoreVisitor };
  const local = parseScore(report.localGoals);
  const visitor = parseScore(report.visitorGoals);
  return local !== null && visitor !== null ? { local, visitor } : null;
}

const noop = () => {};

/** Partido en directo de solo lectura (jugadores y familiares): marcador, reloj, goles, tarjetas y cambios. */
export default function LiveMatchViewer({
  eventId,
  localTeamName,
  localTeamShield,
  visitorTeamName,
  visitorTeamShield,
}: Props) {
  const { state, status, serverOffsetMs } = useLiveMatchServerState(eventId);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const isFinished = state?.phase === "finished" || state?.isClosed === true;
  const { report, status: reportStatus } = useFinishedMatchReport(eventId, isFinished);

  const stateGoals = useMemo(() => parseJsonArray<GoalEvent>(state?.matchData.goalsJson ?? null), [state]);
  const stateCards = useMemo(() => parseJsonArray<CardEvent>(state?.matchData.cardsJson ?? null), [state]);
  const live = isFinished ? report?.live ?? null : null;
  const goals = useMemo(() => (live ? reportGoalsToEvents(live) : stateGoals), [live, stateGoals]);
  const cards = useMemo(() => (live ? reportCardsToEvents(live) : stateCards), [live, stateCards]);

  if (status === "offline" && state === null) {
    return (
      <div className={styles.root}>
        <Alert severity="warning">Sin conexión con el servidor. No se puede mostrar el partido en directo.</Alert>
      </div>
    );
  }

  if (state === null) {
    return (
      <div className={styles.root}>
        <p className={styles.notice}>
          {status === "loading" ? "Cargando el partido…" : "El partido todavía no ha empezado."}
        </p>
      </div>
    );
  }

  const elapsedSeconds = computeElapsedSeconds(state.clock, serverOffsetMs, now);
  const finalScore = isFinished && report ? reportScore(report) : null;
  const scoreLocal = finalScore?.local ?? state.scoreLocal;
  const scoreVisitor = finalScore?.visitor ?? state.scoreVisitor;
  const clockSeconds = isFinished ? state.matchDurationMinutes * 60 : elapsedSeconds;

  return (
    <div className={styles.root}>
      {status === "offline" && (
        <Alert severity="warning">Sin conexión con el servidor. Los datos pueden no estar actualizados.</Alert>
      )}
      <LiveMatchScoreboard
        localTeamName={localTeamName}
        localTeamShield={localTeamShield}
        visitorTeamName={visitorTeamName}
        visitorTeamShield={visitorTeamShield}
        scoreLocal={scoreLocal}
        scoreVisitor={scoreVisitor}
      />
      <div className={styles.clockRow}>
        <span className={styles.badge}>{phaseBadge(state.phase)}</span>
        <span className={styles.clock}>{formatClock(clockSeconds)}</span>
      </div>
      {state.phase === "preMatch" && <p className={styles.notice}>El partido todavía no ha empezado.</p>}
      {isFinished && reportStatus === "error" && (
        <Alert severity="error">No se pudo cargar el informe del partido. Inténtalo de nuevo más tarde.</Alert>
      )}
      <GoalTimeline goals={goals} onRemoveGoal={noop} readOnly />
      <CardsTimeline cards={cards} onRemoveCard={noop} readOnly />
      {live && <LiveMatchSubstitutions windows={live.substitutionWindows} />}
    </div>
  );
}
