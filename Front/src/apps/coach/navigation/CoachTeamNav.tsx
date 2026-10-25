import { Link, useLocation } from "react-router-dom";
import { usePermissions } from "../../../shared/hooks/usePermissions";
import useIsPlayerRole from "../hooks/useIsPlayerRole";
import { buildTeamNavTabs } from "./teamNavTabs";
import { useTeamContextId } from "./useTeamContextId";
import styles from "./CoachTeamNav.module.css";

const NO_ACCESS = () => false;

/**
 * Team navigation of the Coach app: a bottom tab bar on phones/tablets and a
 * left rail on desktop (layout handled by BaseLayout + this CSS module).
 */
export default function CoachTeamNav() {
  const { pathname } = useLocation();
  const isPlayer = useIsPlayerRole();
  const { loading, hasFeatureAccess } = usePermissions();
  const teamId = useTeamContextId(isPlayer);

  // Until permissions arrive only the always-present tabs are shown, so no
  // tab appears and then disappears.
  const tabs = buildTeamNavTabs({
    teamId,
    isPlayer,
    hasFeatureAccess: loading ? NO_ACCESS : hasFeatureAccess,
    pathname,
  });

  return (
    <nav className={styles.nav} aria-label="Navegación del equipo">
      {tabs.map(({ key, label, to, icon: Icon, active }) => (
        <Link
          key={key}
          to={to}
          className={active ? `${styles.tab} ${styles.active}` : styles.tab}
          aria-current={active ? "page" : undefined}
        >
          <Icon className={styles.icon} aria-hidden="true" />
          <span className={styles.label}>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
