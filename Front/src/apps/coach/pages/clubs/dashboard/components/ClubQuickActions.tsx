import { Link } from "react-router-dom";
import type { SvgIconComponent } from "@mui/icons-material";
import SportsFootballIcon from "@mui/icons-material/SportsFootball";
import PeopleIcon from "@mui/icons-material/People";
import GroupIcon from "@mui/icons-material/Group";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import MarkEmailUnreadOutlinedIcon from "@mui/icons-material/MarkEmailUnreadOutlined";
import AddModeratorOutlinedIcon from "@mui/icons-material/AddModeratorOutlined";
import { usePermissions } from "../../../../../../shared/hooks/usePermissions";
import { COACH_FEATURE_ROUTES } from "../../../../constants/featureRoutes";
import styles from "./ClubQuickActions.module.css";

interface ClubQuickActionsProps {
  clubId: string;
  seasonId?: string;
  pendingRequests?: number;
}

type ClubAction = {
  key: string;
  label: string;
  to: string;
  icon: SvgIconComponent;
  requiresClubTeams?: boolean;
  badge?: number;
};

export default function ClubQuickActions({
  clubId,
  seasonId,
  pendingRequests = 0,
}: ClubQuickActionsProps) {
  const { loading, hasFeatureAccess } = usePermissions();
  const seasonQuery = seasonId ? `?seasonId=${seasonId}` : "";
  const clubPath = (section: string) => `/coach/clubs/${clubId}/${section}`;

  const actions: ClubAction[] = [
    { key: "teams", label: "Equipos", to: `${clubPath("teams")}${seasonQuery}`, icon: SportsFootballIcon, requiresClubTeams: true },
    { key: "players", label: "Jugadores", to: `${clubPath("players")}${seasonQuery}`, icon: PeopleIcon },
    { key: "staff", label: "Personal", to: `/scope/members?scope=club&id=${clubId}`, icon: GroupIcon },
    { key: "registrations", label: "Inscripciones", to: `${clubPath("registrations")}${seasonQuery}`, icon: HowToRegIcon },
    { key: "join-requests", label: "Solicitudes de acceso", to: `/club-join-requests?clubId=${clubId}`, icon: MarkEmailUnreadOutlinedIcon, badge: pendingRequests },
    { key: "new-team", label: "Nuevo equipo", to: clubPath("teams/new"), icon: AddModeratorOutlinedIcon, requiresClubTeams: true },
  ];

  if (loading) return null;

  const canManageTeams = hasFeatureAccess(COACH_FEATURE_ROUTES.ClubTeams);
  const visible = actions.filter((a) => !a.requiresClubTeams || canManageTeams);

  return (
    <section aria-labelledby="club-quick-actions-title" className={styles.section}>
      <h3 id="club-quick-actions-title" className={styles.title}>Acciones rápidas</h3>
      <ul className={styles.grid}>
        {visible.map(({ key, label, to, icon: Icon, badge }) => (
          <li key={key}>
            <Link to={to} className={styles.action}>
              <Icon className={styles.icon} aria-hidden="true" />
              <span>{label}</span>
              {badge ? <span className={styles.badge}>{badge}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
