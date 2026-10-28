import { useMemo } from "react";
import { Link } from "react-router-dom";
import { usePermissions } from "../../../../../shared/hooks/usePermissions";
import { buildTeamSections } from "../../../navigation/teamSections";
import styles from "./QuickActions.module.css";

const QUICK_ACTION_KEYS = ["squad", "injured", "attendance-summary", "quiniela"];

export default function QuickActions({ teamId }: { teamId: string | null }) {
  const { loading, hasFeatureAccess } = usePermissions();

  const items = useMemo(() => {
    if (loading) return [];
    const all = buildTeamSections({ teamId, isPlayer: false, hasFeatureAccess }).flatMap((g) => g.items);
    return QUICK_ACTION_KEYS.flatMap((key) => all.filter((item) => item.key === key));
  }, [loading, teamId, hasFeatureAccess]);

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="quick-actions-title" className={styles.section}>
      <h3 id="quick-actions-title" className={styles.title}>Acciones rápidas</h3>
      <ul className={styles.grid}>
        {items.map(({ key, label, to, icon: Icon }) => (
          <li key={key}>
            <Link to={to} className={styles.action}>
              <Icon className={styles.icon} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
