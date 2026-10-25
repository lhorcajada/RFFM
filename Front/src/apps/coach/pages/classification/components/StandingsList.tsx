import type { ReactNode } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { ClassificationTeam } from "../../../../../shared/hooks/useClassification";
import {
  formatGoalDifference,
  getStandingZone,
  toForm,
  type StandingSpots,
  type StandingZone,
} from "../standings";
import FormBadges from "./FormBadges";
import PositionBadge from "./PositionBadge";
import styles from "./StandingsList.module.css";

type StandingsListProps = {
  teams: ClassificationTeam[];
  ownTeamId?: string | null;
  selectedTeamId: string | null;
  onSelect: (teamId: string) => void;
  isDesktop: boolean;
  spots: StandingSpots;
  renderInlineDetail: (team: ClassificationTeam) => ReactNode;
};

const ZONE_DESCRIPTION: Record<StandingZone, string> = {
  promotion: ", zona de ascenso",
  playoff: ", zona de promoción",
  relegation: ", zona de descenso",
  neutral: "",
};

function goalDifferenceClass(team: ClassificationTeam): string {
  const difference = team.goalsFor - team.goalsAgainst;
  if (difference > 0) return styles.positive;
  if (difference < 0) return styles.negative;
  return "";
}

export default function StandingsList({
  teams,
  ownTeamId,
  selectedTeamId,
  onSelect,
  isDesktop,
  spots,
  renderInlineDetail,
}: StandingsListProps) {
  return (
    <div className={`${styles.list} ${isDesktop ? styles.listDesktop : ""}`}>
      <div className={styles.inner}>
        <div className={`${styles.row} ${styles.headerRow}`} aria-hidden="true">
          <span className={styles.zoneBar} />
          <span className={styles.pos}>#</span>
          <span className={styles.name}>Equipo</span>
          {isDesktop && (
            <>
              <span className={styles.num} data-column>PJ</span>
              <span className={styles.num} data-column>G</span>
              <span className={styles.num} data-column>E</span>
              <span className={styles.num} data-column>P</span>
              <span className={styles.goals} data-column>Goles</span>
              <span className={styles.dg} data-column>DG</span>
              <span className={styles.form} data-column>Últimos 5</span>
            </>
          )}
          <span className={styles.pts} data-column>Pts</span>
          {!isDesktop && <span className={styles.chevron} />}
        </div>

        {teams.map((team) => {
          const isSelected = selectedTeamId === team.teamId;
          const isOwn = ownTeamId === team.teamId;
          const zone = getStandingZone(team.position, teams.length, spots);
          const rowClass = [
            styles.item,
            isOwn ? styles.own : "",
            isSelected ? styles.selected : "",
          ].join(" ");
          return (
            <div key={team.teamId} className={rowClass}>
              <button
                type="button"
                className={`${styles.row} ${styles.rowButton}`}
                onClick={() => onSelect(team.teamId)}
                aria-label={`${team.position}º ${team.teamName}, ${team.points} puntos${ZONE_DESCRIPTION[zone]}`}
                {...(isDesktop ? { "aria-pressed": isSelected } : { "aria-expanded": isSelected })}
              >
                <span className={`${styles.zoneBar} ${styles[zone]}`} aria-hidden="true" />
                <span className={styles.pos}>
                  <PositionBadge position={team.position} />
                </span>
                <span className={`${styles.name} ${isOwn ? styles.ownName : ""}`}>{team.teamName}</span>
                {isDesktop && (
                  <>
                    <span className={styles.num}>{team.played}</span>
                    <span className={styles.num}>{team.won}</span>
                    <span className={styles.num}>{team.drawn}</span>
                    <span className={styles.num}>{team.lost}</span>
                    <span className={styles.goals}>
                      {team.goalsFor}:{team.goalsAgainst}
                    </span>
                    <span className={`${styles.dg} ${goalDifferenceClass(team)}`}>
                      {formatGoalDifference(team.goalsFor, team.goalsAgainst)}
                    </span>
                    <span className={styles.form}>
                      <FormBadges form={toForm(team.matchStreaks)} size="small" />
                    </span>
                  </>
                )}
                <span className={styles.pts}>{team.points}</span>
                {!isDesktop && (
                  <ExpandMoreIcon
                    className={`${styles.chevron} ${isSelected ? styles.chevronOpen : ""}`}
                    fontSize="small"
                    aria-hidden="true"
                  />
                )}
              </button>
              {!isDesktop && isSelected && renderInlineDetail(team)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
