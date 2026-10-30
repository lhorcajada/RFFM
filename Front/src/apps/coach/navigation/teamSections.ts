import type { SvgIconComponent } from "@mui/icons-material";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import CheckroomOutlinedIcon from "@mui/icons-material/CheckroomOutlined";
import HealingOutlinedIcon from "@mui/icons-material/HealingOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import FitnessCenterOutlinedIcon from "@mui/icons-material/FitnessCenterOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ScoreboardOutlinedIcon from "@mui/icons-material/ScoreboardOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import QueryStatsOutlinedIcon from "@mui/icons-material/QueryStatsOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import SchemaOutlinedIcon from "@mui/icons-material/SchemaOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import StyleOutlinedIcon from "@mui/icons-material/StyleOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import NewspaperOutlinedIcon from "@mui/icons-material/NewspaperOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import SportsSoccerOutlinedIcon from "@mui/icons-material/SportsSoccerOutlined";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import { COACH_FEATURE_ROUTES } from "../constants/featureRoutes";

export type TeamSectionItem = {
  key: string;
  label: string;
  to: string;
  icon: SvgIconComponent;
};

export type TeamSectionGroup = {
  title: string;
  items: TeamSectionItem[];
};

export type TeamSectionsInput = {
  teamId: string | null;
  isPlayer: boolean;
  hasFeatureAccess: (route: string) => boolean;
};

type CandidateItem = TeamSectionItem & { visible: boolean };

export function withTeamId(path: string, teamId: string | null): string {
  return teamId ? `${path}?teamId=${encodeURIComponent(teamId)}` : path;
}

/**
 * Single source of truth for the team sections reachable from the Coach team
 * menu (`/coach/menu`). Keeps the exact visibility rules and routes the team
 * dashboard's launcher tiles used, plus an extra "Cuenta" group.
 */
export function buildTeamSections({
  teamId,
  isPlayer,
  hasFeatureAccess,
}: TeamSectionsInput): TeamSectionGroup[] {
  const team = (path: string) => withTeamId(path, teamId);
  const canSeeCompetition = hasFeatureAccess(COACH_FEATURE_ROUTES.Convocations);

  const groups: { title: string; items: CandidateItem[] }[] = [
    {
      title: "Equipo",
      items: [
        { key: "team-users", label: "Gestión de usuarios", to: team("/coach/team-users"), icon: GroupOutlinedIcon, visible: !isPlayer },
        { key: "squad", label: "Plantilla", to: team("/coach/squad"), icon: CheckroomOutlinedIcon, visible: hasFeatureAccess(COACH_FEATURE_ROUTES.Squad) },
        { key: "injured", label: "Lesionados", to: team("/coach/injured"), icon: HealingOutlinedIcon, visible: hasFeatureAccess(COACH_FEATURE_ROUTES.Injured) },
      ],
    },
    {
      title: "Actividad",
      items: [
        { key: "events", label: "Eventos", to: team("/coach/attendance"), icon: EventOutlinedIcon, visible: hasFeatureAccess(COACH_FEATURE_ROUTES.Events) },
        { key: "trainings", label: "Entrenamientos", to: team("/coach/trainings"), icon: FitnessCenterOutlinedIcon, visible: hasFeatureAccess(COACH_FEATURE_ROUTES.Trainings) },
        { key: "attendance-summary", label: "Resumen de asistencias", to: team("/coach/attendance/summary"), icon: FactCheckOutlinedIcon, visible: hasFeatureAccess(COACH_FEATURE_ROUTES.AttendanceSummary) },
      ],
    },
    {
      title: "Competición",
      items: [
        { key: "convocations", label: "Calendario", to: team("/coach/convocations"), icon: CalendarMonthOutlinedIcon, visible: canSeeCompetition },
        { key: "results", label: "Resultados", to: team("/coach/results"), icon: ScoreboardOutlinedIcon, visible: canSeeCompetition },
        { key: "classification", label: "Clasificación", to: team("/coach/classification"), icon: EmojiEventsOutlinedIcon, visible: canSeeCompetition },
        { key: "rival-stats", label: "Estadísticas de rivales", to: team("/coach/rival-stats"), icon: QueryStatsOutlinedIcon, visible: canSeeCompetition },
        { key: "quiniela", label: "Quiniela", to: team("/coach/quiniela"), icon: SportsSoccerOutlinedIcon, visible: hasFeatureAccess(COACH_FEATURE_ROUTES.Quiniela) },
        { key: "quiniela-history", label: "Histórico de quinielas", to: team("/coach/quiniela/historico"), icon: HistoryOutlinedIcon, visible: hasFeatureAccess(COACH_FEATURE_ROUTES.Quiniela) },
        { key: "quiniela-pool", label: "Bolsa de la quiniela", to: team("/coach/quiniela/bolsa"), icon: PaymentsOutlinedIcon, visible: !isPlayer && hasFeatureAccess(COACH_FEATURE_ROUTES.Quiniela) },
        { key: "quiniela-wallets", label: "Monederos de la quiniela", to: team("/coach/quiniela/monederos"), icon: AccountBalanceWalletOutlinedIcon, visible: !isPlayer && hasFeatureAccess(COACH_FEATURE_ROUTES.Quiniela) },
        { key: "rivals", label: "Rivales", to: "/coach/rivals", icon: ShieldOutlinedIcon, visible: hasFeatureAccess(COACH_FEATURE_ROUTES.Rivals) },
        { key: "game-model", label: "Modelo de Juego", to: team("/coach/game-model"), icon: SchemaOutlinedIcon, visible: hasFeatureAccess(COACH_FEATURE_ROUTES.GameModel) },
      ],
    },
    {
      title: "Disciplina",
      items: [
        { key: "team-rules", label: "Normas del Equipo", to: team("/coach/team-rules"), icon: MenuBookOutlinedIcon, visible: hasFeatureAccess(COACH_FEATURE_ROUTES.TeamRulesDocument) },
        { key: "sanctions", label: "Sanciones", to: team("/coach/sanctions"), icon: StyleOutlinedIcon, visible: hasFeatureAccess(COACH_FEATURE_ROUTES.Sanctions) },
        { key: "my-documents", label: "Mis documentos", to: "/coach/my-documents", icon: DescriptionOutlinedIcon, visible: isPlayer && hasFeatureAccess(COACH_FEATURE_ROUTES.MyDocuments) },
        { key: "player-documents", label: "Documentos", to: team("/coach/player-documents"), icon: DescriptionOutlinedIcon, visible: !isPlayer && hasFeatureAccess(COACH_FEATURE_ROUTES.PlayerDocuments) },
      ],
    },
    {
      title: "Otros",
      items: [
        { key: "news", label: "Noticias", to: "/coach/news", icon: NewspaperOutlinedIcon, visible: hasFeatureAccess(COACH_FEATURE_ROUTES.News) },
        { key: "lottery", label: "Lotería", to: "/coach/lottery", icon: ConfirmationNumberOutlinedIcon, visible: hasFeatureAccess(COACH_FEATURE_ROUTES.Lottery) },
        { key: "season-access", label: "Pruebas de acceso", to: "/coach/season-access", icon: AssignmentTurnedInOutlinedIcon, visible: hasFeatureAccess(COACH_FEATURE_ROUTES.SeasonAccess) },
        // Every authenticated role has its own inbox, scoped server-side to the user.
        { key: "notifications", label: "Notificaciones", to: "/coach/notifications", icon: NotificationsNoneOutlinedIcon, visible: true },
      ],
    },
    {
      title: "Cuenta",
      items: [
        { key: "home-dashboard", label: "Panel general", to: "/coach/dashboard", icon: DashboardOutlinedIcon, visible: !isPlayer },
        { key: "settings", label: "Configuración", to: "/coach/settings", icon: SettingsOutlinedIcon, visible: !isPlayer && hasFeatureAccess(COACH_FEATURE_ROUTES.Settings) },
        { key: "profile", label: "Mi perfil", to: "/profile", icon: AccountCircleOutlinedIcon, visible: true },
      ],
    },
  ];

  return groups
    .map((group) => ({
      title: group.title,
      items: group.items
        .filter((item) => item.visible)
        .map(({ visible: _visible, ...item }) => item),
    }))
    .filter((group) => group.items.length > 0);
}
