import { useState } from "react";
import { Collapse, IconButton, Stack, Typography } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import type { PlayerMatchRecord } from "../../convocations/components/simulation/liveMatch.types";
import { derivePlayerStints } from "./playerMatchStints";
import styles from "./PlayerMatchHistoryCards.module.css";

type Props = {
  matchHistory: PlayerMatchRecord[];
  teamPlayerId: string;
};

function formatMatchDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function MatchHistoryCard({ record, teamPlayerId }: { record: PlayerMatchRecord; teamPlayerId: string }) {
  const [expanded, setExpanded] = useState(false);
  const stints = derivePlayerStints(record, teamPlayerId);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <span className={styles.rival}>{record.rivalName ?? "—"}</span>
          <span className={styles.type}>{record.eventTypeName || "—"}</span>
        </div>
        <span className={styles.date}>{formatMatchDate(record.matchDate)}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.scoreBlock}>
          <span className={styles.score}>
            {record.scoreLocal}:{record.scoreVisitor}
          </span>
          <span className={record.isStarter ? styles.starterBadge : styles.calledUpBadge}>
            {record.isStarter ? "Titular" : "Convocado"}
          </span>
        </div>

        <div className={styles.statsRow}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{record.minutesPlayed}'</span>
            <span className={styles.statLabel}>Min</span>
          </div>
          <div className={styles.statItem}>
            <span className={record.goalsScored > 0 ? styles.statValueGoals : styles.statValueMuted}>
              {record.goalsScored}
            </span>
            <span className={styles.statLabel}>Goles</span>
          </div>
          <Stack direction="row" spacing={0.75} className={styles.cardsCell}>
            {record.yellowCards > 0 && <span>🟨{record.yellowCards}</span>}
            {record.redCards > 0 && <span>🟥{record.redCards}</span>}
            {record.yellowCards === 0 && record.redCards === 0 && (
              <span className={styles.statValueMuted}>—</span>
            )}
          </Stack>
        </div>
      </div>

      <div className={styles.footer}>
        <IconButton
          size="small"
          aria-label={expanded ? "Contraer detalle" : "Expandir detalle"}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
        </IconButton>
      </div>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <div className={styles.stintsWrapper}>
          {stints.length === 0 ? (
            <Typography className={styles.stintsEmpty}>Sin sustituciones registradas.</Typography>
          ) : (
            stints.map((stint, idx) => (
              <Typography key={idx} className={styles.stintItem}>
                {stint.enteredAtMinute}' — {stint.exitedAtMinute != null ? `${stint.exitedAtMinute}'` : "final del partido"}
              </Typography>
            ))
          )}
        </div>
      </Collapse>
    </div>
  );
}

export default function PlayerMatchHistoryCards({ matchHistory, teamPlayerId }: Props) {
  return (
    <div className={styles.list}>
      {matchHistory.map((record) => (
        <MatchHistoryCard key={record.eventId} record={record} teamPlayerId={teamPlayerId} />
      ))}
    </div>
  );
}
