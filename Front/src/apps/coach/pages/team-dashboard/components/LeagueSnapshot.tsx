import { Link } from "react-router-dom";
import useClassification from "../../../../../shared/hooks/useClassification";
import { useRffmSeason } from "../../../../../shared/context/RffmSeasonContext";
import { usePermissions } from "../../../../../shared/hooks/usePermissions";
import { COACH_FEATURE_ROUTES } from "../../../constants/featureRoutes";
import { withTeamId } from "../../../navigation/teamSections";
import type { TeamResponse } from "../../../services/teamService";
import useOwnTeamSeason from "../../results/hooks/useOwnTeamSeason";
import OutcomeBadge from "../../results/components/OutcomeBadge";
import { buildLeagueSnapshot } from "../utils/leagueSnapshot";
import styles from "./LeagueSnapshot.module.css";

type Props = {
  team: TeamResponse | null;
  isPlayer: boolean;
};

export default function LeagueSnapshot({ team, isPlayer }: Props) {
  const { seasonId, currentSeasonId } = useRffmSeason();
  const { loading: permissionsLoading, hasFeatureAccess } = usePermissions();

  const season = String(currentSeasonId ?? seasonId ?? "");
  const hasCompetition = Boolean(team?.rffmCompetitionId && team?.rffmGroupId);
  const canLoad = isPlayer && hasCompetition && season !== "";
  const competition = canLoad ? String(team?.rffmCompetitionId) : undefined;
  const group = canLoad ? String(team?.rffmGroupId) : undefined;
  const teamCode = team?.rffmTeamCode ? String(team.rffmTeamCode) : null;

  const { teams, loading } = useClassification({ season, competition, group });
  const { ownByRound, loading: seasonLoading } = useOwnTeamSeason({ season, competition, group, teamCode });

  const canSeeCompetition = !permissionsLoading && hasFeatureAccess(COACH_FEATURE_ROUTES.Convocations);
  if (!canLoad || !team || loading || seasonLoading || !canSeeCompetition) return null;

  const snapshot = buildLeagueSnapshot(teams, ownByRound, teamCode);
  if (!snapshot) return null;

  const { lastMatch, form } = snapshot;

  return (
    <section aria-labelledby="league-snapshot-title" className={styles.section}>
      <h3 id="league-snapshot-title" className={styles.title}>Liga</h3>
      <div className={styles.tiles}>
        {lastMatch && (
          <Link to={withTeamId("/coach/results", team.id)} className={styles.tile}>
            <span className={styles.label}>Último resultado</span>
            <span className={styles.valueRow}>
              <span className={styles.value}>{`${lastMatch.mine} – ${lastMatch.theirs}`}</span>
              <OutcomeBadge outcome={lastMatch.outcome} />
            </span>
            <span className={styles.label}>{`J${lastMatch.round} · vs ${lastMatch.opponent}`}</span>
          </Link>
        )}
        <Link to={withTeamId("/coach/classification", team.id)} className={styles.tile}>
          <span className={styles.label}>Posición</span>
          <span className={styles.valueRow}>
            <span className={styles.value}>{`${snapshot.position}.º`}</span>
            <span className={styles.label}>{`${snapshot.points} pts`}</span>
          </span>
          {form.length > 0 && (
            <ul aria-label={`Últimos ${form.length}: ${form.join(" ")}`} className={styles.form}>
              {form.map((outcome, index) => (
                <li key={index}>
                  <OutcomeBadge outcome={outcome} />
                </li>
              ))}
            </ul>
          )}
        </Link>
      </div>
    </section>
  );
}
