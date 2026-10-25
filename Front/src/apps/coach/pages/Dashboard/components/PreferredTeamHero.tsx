import { Link } from "react-router-dom";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import type { TeamResponse } from "../../../services/teamService";
import type { DashboardLayout } from "../hooks/useDashboardLayout";
import TeamShield from "./TeamShield";
import styles from "./PreferredTeamHero.module.css";

interface PreferredTeamHeroProps {
  team: TeamResponse;
  teamImageUrl: string | null;
  clubEmblemUrl: string | null;
  layout: DashboardLayout;
}

export default function PreferredTeamHero({
  team,
  teamImageUrl,
  clubEmblemUrl,
  layout,
}: PreferredTeamHeroProps) {
  const isMobile = layout === "mobile";
  const ctaLabel = isMobile ? "Abrir panel del equipo" : "Abrir panel";
  const categoryName = team.category?.name;

  return (
    <section
      className={`${styles.hero} ${styles[layout] ?? ""}`.trim()}
      aria-label="Equipo preferido"
    >
      <span className={styles.corner} aria-hidden="true" />
      <div className={styles.identity}>
        <TeamShield
          name={team.name}
          imageUrl={teamImageUrl}
          size={isMobile ? "lg" : "xl"}
          className={styles.shield}
        />
        <div className={styles.info}>
          <span className={styles.eyebrow}>Equipo preferido</span>
          <h2 className={styles.teamName}>{team.name}</h2>
          <div className={styles.club}>
            {clubEmblemUrl ? (
              <img className={styles.clubEmblem} src={clubEmblemUrl} alt="" />
            ) : (
              <span className={styles.clubEmblem} aria-hidden="true" />
            )}
            <strong className={styles.clubName}>{team.club?.name}</strong>
            {categoryName && <span className={styles.category}>· {categoryName}</span>}
          </div>
        </div>
      </div>
      <Link className={styles.cta} to={`/coach/team-dashboard?teamId=${team.id}`}>
        {ctaLabel}
        <ArrowForwardIcon className={styles.ctaIcon} aria-hidden="true" />
      </Link>
    </section>
  );
}
