import { useEffect, useMemo, useState } from "react";
import { Alert } from "@mui/material";
import { useLiveMatchServerState } from "../hooks/useLiveMatchServerState";
import { computeElapsedSeconds } from "../utils/liveMatchClock";
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

const noop = () => {};

/** Partido en directo de solo lectura (jugadores y familiares): marcador, reloj, goles y tarjetas. */
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

  const goals = useMemo(() => parseJsonArray<GoalEvent>(state?.matchData.goalsJson ?? null), [state]);
  const cards = useMemo(() => parseJsonArray<CardEvent>(state?.matchData.cardsJson ?? null), [state]);

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
        scoreLocal={state.scoreLocal}
        scoreVisitor={state.scoreVisitor}
      />
      <div className={styles.clockRow}>
        <span className={styles.badge}>{phaseBadge(state.phase)}</span>
        <span className={styles.clock}>{formatClock(elapsedSeconds)}</span>
      </div>
      {state.phase === "preMatch" && <p className={styles.notice}>El partido todavía no ha empezado.</p>}
      <GoalTimeline goals={goals} onRemoveGoal={noop} readOnly />
      <CardsTimeline cards={cards} onRemoveCard={noop} readOnly />
    </div>
  );
}
