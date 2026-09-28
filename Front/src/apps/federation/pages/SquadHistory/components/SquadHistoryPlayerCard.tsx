import React from "react";
import { Chip, Paper, Typography } from "@mui/material";
import type {
  SquadHistoryPlayer,
  SquadHistoryTeam,
} from "../../../services/squadHistoryService";
import { sortTeamsByCallUps } from "../squadHistoryOrder";
import styles from "./SquadHistoryPlayerCard.module.css";

const EMPTY_VALUE = "—";

function formatValue(value: number | null): string {
  return value === null || value === undefined ? EMPTY_VALUE : String(value);
}

function Stat({ label, shortLabel, value }: { label: string; shortLabel: string; value: string }) {
  return (
    <li className={styles.stat} aria-label={`${label}: ${value}`} title={label}>
      <span className={styles.statLabel} aria-hidden="true">
        {shortLabel}
      </span>
      <strong className={styles.statValue} aria-hidden="true">
        {value}
      </strong>
    </li>
  );
}

function TeamCard({ team, seasonName }: { team: SquadHistoryTeam; seasonName: string }) {
  if (!team.teamCode) {
    return (
      <Typography variant="body2" className={styles.unavailable}>
        No se pudieron obtener los datos de esta temporada.
      </Typography>
    );
  }

  const points = team.teamPosition > 0 ? `${team.teamPoints} (${team.teamPosition}º)` : String(team.teamPoints);

  return (
    <section className={styles.team} aria-label={`${team.teamName} · ${seasonName}`}>
      <div className={styles.teamHeader}>
        <Typography component="h5" className={styles.teamName}>
          {team.teamName}
        </Typography>
        <Chip
          size="small"
          variant="outlined"
          className={styles.sourceChip}
          label={team.source === "Actas" ? "Desde actas" : "Totales de temporada"}
        />
        {team.isIncomplete && <Chip size="small" color="warning" className={styles.sourceChip} label="Incompleto" />}
      </div>
      <Typography variant="caption" className={styles.competition}>
        {`${team.competitionName} · ${team.groupName}`}
      </Typography>
      <ul className={styles.stats}>
        <Stat label="Puntos" shortLabel="Pts" value={points} />
        <Stat label="Convocatorias" shortLabel="Conv" value={formatValue(team.callUps)} />
        <Stat label="Titularidades" shortLabel="Tit" value={formatValue(team.starts)} />
        <Stat label="Goles" shortLabel="Gol" value={String(team.goals)} />
        <Stat label="Amarillas" shortLabel="TA" value={String(team.yellowCards)} />
        <Stat label="Rojas" shortLabel="TR" value={String(team.redCards)} />
      </ul>
    </section>
  );
}

export default function SquadHistoryPlayerCard({ player }: { player: SquadHistoryPlayer }): JSX.Element {
  return (
    <Paper component="article" aria-label={player.playerName} className={styles.card}>
      <div className={styles.header}>
        <Typography component="h3" className={styles.playerName}>
          {player.playerName}
        </Typography>
        {player.birthYear && (
          <Typography variant="body2" className={styles.birthYear}>{`Nacido en ${player.birthYear}`}</Typography>
        )}
        {player.isIncomplete && <Chip size="small" color="warning" label="Datos incompletos" />}
      </div>
      {player.originTeamName && (
        <Chip
          size="small"
          color="info"
          variant="outlined"
          className={styles.origin}
          label={`Procede de ${player.originTeamName}`}
        />
      )}
      {player.seasons.map((season) => (
        <div key={season.seasonId} className={styles.season}>
          <Typography component="h4" className={styles.seasonTitle}>
            {`Temporada ${season.seasonName}`}
          </Typography>
          {season.teams.length === 0 ? (
            <Typography variant="body2" className={styles.unavailable}>
              Sin equipos en esta temporada.
            </Typography>
          ) : (
            <div className={styles.teams}>
              {sortTeamsByCallUps(season.teams).map((team, index) => (
                <TeamCard key={`${team.teamCode}-${team.groupCode}-${index}`} team={team} seasonName={season.seasonName} />
              ))}
            </div>
          )}
        </div>
      ))}
    </Paper>
  );
}
