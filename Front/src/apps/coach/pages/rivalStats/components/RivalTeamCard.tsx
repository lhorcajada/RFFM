import { useState } from "react";
import { Alert, Avatar, Chip, CircularProgress, Collapse, Paper } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { getRivalTeamStats, type RivalPlayer, type RivalTeamSummary } from "../../../services/rivalStatsService";
import RivalPlayerCard from "./RivalPlayerCard";
import styles from "./RivalTeamCard.module.css";

type Props = {
  teamId: string;
  team: RivalTeamSummary;
};

function playerCountLabel(count: number): string {
  return count === 1 ? "1 jugador" : `${count} jugadores`;
}

// One league team; its players are fetched the first time the card is opened.
export default function RivalTeamCard({ teamId, team }: Props) {
  const [open, setOpen] = useState(false);
  const [players, setPlayers] = useState<RivalPlayer[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const toggle = () => {
    const willOpen = !open;
    setOpen(willOpen);
    const mustLoad = willOpen && players === null && !loading;
    if (!mustLoad) return;

    setLoading(true);
    setError(false);
    getRivalTeamStats(teamId, team.teamCode)
      .then((data) => setPlayers(data.players))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  const panelId = `rival-team-${team.teamCode}`;

  return (
    <Paper className={`${styles.card} ${team.isOwnTeam ? styles.ownTeam : ""}`} elevation={0}>
      <button type="button" className={styles.header} onClick={toggle} aria-expanded={open} aria-controls={panelId}>
        <Avatar src={team.shieldUrl || undefined} alt="" className={styles.shield} />
        <span className={styles.titleBlock}>
          <span className={styles.teamName}>{team.teamName}</span>
          <span className={styles.playerCount}>{playerCountLabel(team.playerCount)}</span>
        </span>
        {team.isOwnTeam && <Chip size="small" color="primary" label="Tu equipo" />}
        <ExpandMoreIcon className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} />
      </button>
      <Collapse in={open} unmountOnExit>
        <div id={panelId} className={styles.panel}>
          {loading && (
            <div className={styles.center}>
              <CircularProgress size={24} />
            </div>
          )}
          {error && <Alert severity="warning">No se han podido cargar los jugadores del equipo.</Alert>}
          {players?.length === 0 && <Alert severity="info">Este equipo no tiene jugadores en su plantilla.</Alert>}
          {players && players.length > 0 && (
            <div className={styles.players}>
              {players.map((player) => (
                <RivalPlayerCard key={player.playerCode} player={player} />
              ))}
            </div>
          )}
        </div>
      </Collapse>
    </Paper>
  );
}
