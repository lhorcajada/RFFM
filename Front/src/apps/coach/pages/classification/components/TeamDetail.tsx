import { useMemo, useState } from "react";
import { Button } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type {
  ClassificationTeam,
  ClassificationTeamMatch,
} from "../../../../../shared/hooks/useClassification";
import { formatGoalDifference, getPlayedResults, pointsPerMatch, toForm } from "../standings";
import FormBadges from "./FormBadges";
import PositionBadge from "./PositionBadge";
import ResultRow from "./ResultRow";
import TeamResultsDialog from "./TeamResultsDialog";
import styles from "./TeamDetail.module.css";

type TeamDetailProps = {
  team: ClassificationTeam;
  gapText: string;
  matches: ClassificationTeamMatch[];
  variant: "inline" | "panel";
};

const RECENT_RESULTS = { inline: 3, panel: 5 };

export default function TeamDetail({ team, gapText, matches, variant }: TeamDetailProps) {
  const [resultsOpen, setResultsOpen] = useState(false);
  const results = useMemo(() => getPlayedResults(matches), [matches]);
  const form = toForm(team.matchStreaks);
  const recent = results.slice(0, RECENT_RESULTS[variant]);

  return (
    <section
      className={`${styles.detail} ${variant === "panel" ? styles.panel : styles.inline}`}
      aria-label={`Detalle de ${team.teamName}`}
    >
      {variant === "panel" && (
        <div className={styles.header}>
          <PositionBadge position={team.position} size="large" suffix="º" />
          <div className={styles.headerInfo}>
            <span className={styles.teamName}>{team.teamName}</span>
            {gapText && <span className={styles.muted}>{gapText}</span>}
          </div>
          <div className={styles.points}>
            <span className={styles.pointsValue}>{team.points}</span>
            <span className={styles.muted}>puntos</span>
          </div>
        </div>
      )}

      <dl className={styles.stats}>
        <div className={styles.tile}>
          <dt>Jugados</dt>
          <dd>{team.played}</dd>
        </div>
        <div className={styles.tile}>
          <dt>Ganados</dt>
          <dd className={styles.won}>{team.won}</dd>
        </div>
        <div className={styles.tile}>
          <dt>Empatados</dt>
          <dd>{team.drawn}</dd>
        </div>
        <div className={styles.tile}>
          <dt>Perdidos</dt>
          <dd className={styles.lost}>{team.lost}</dd>
        </div>
        <div className={styles.tile}>
          <dt>Goles a favor</dt>
          <dd>{team.goalsFor}</dd>
        </div>
        <div className={styles.tile}>
          <dt>Goles en contra</dt>
          <dd>{team.goalsAgainst}</dd>
        </div>
        <div className={styles.tile}>
          <dt>Dif. goles</dt>
          <dd>{formatGoalDifference(team.goalsFor, team.goalsAgainst)}</dd>
        </div>
        <div className={styles.tile}>
          <dt>Pts/partido</dt>
          <dd>{pointsPerMatch(team.points, team.played)}</dd>
        </div>
      </dl>

      {form.length > 0 && (
        <div className={styles.formRow}>
          <span className={styles.muted}>Últimos 5</span>
          <FormBadges form={form} />
        </div>
      )}

      {recent.length > 0 && (
        <div className={styles.results}>
          <span className={styles.sectionTitle}>Últimos resultados</span>
          <ul className={styles.resultsList}>
            {recent.map((match, index) => (
              <ResultRow key={`${match.date}-${index}`} match={match} />
            ))}
          </ul>
        </div>
      )}

      <Button
        variant={variant === "panel" ? "contained" : "outlined"}
        endIcon={<ChevronRightIcon />}
        onClick={() => setResultsOpen(true)}
        fullWidth
      >
        Ver todos los resultados
      </Button>

      <TeamResultsDialog
        open={resultsOpen}
        teamName={team.teamName}
        results={results}
        onClose={() => setResultsOpen(false)}
      />
    </section>
  );
}
