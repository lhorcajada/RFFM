import type { SvgIconComponent } from "@mui/icons-material";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import FitnessCenterOutlinedIcon from "@mui/icons-material/FitnessCenterOutlined";
import ScoreboardOutlinedIcon from "@mui/icons-material/ScoreboardOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import { COACH_FEATURE_ROUTES } from "../constants/featureRoutes";
import { withTeamId } from "./teamSections";
import { matchesRoute } from "./teamNavRoutes";

export type TeamNavTab = {
  key: string;
  label: string;
  to: string;
  icon: SvgIconComponent;
  active: boolean;
};

export type TeamNavTabsInput = {
  teamId: string | null;
  isPlayer: boolean;
  hasFeatureAccess: (route: string) => boolean;
  pathname: string;
};

type TabDefinition = {
  key: string;
  label: string;
  path: string;
  icon: SvgIconComponent;
  featureRoute?: string;
};

const HOME_TAB: TabDefinition = { key: "home", label: "Inicio", path: "/coach/team-dashboard", icon: HomeOutlinedIcon };
const MENU_TAB: TabDefinition = { key: "menu", label: "Menú", path: "/coach/menu", icon: GridViewOutlinedIcon };
const EVENTS_TAB: TabDefinition = { key: "events", label: "Eventos", path: "/coach/attendance", icon: EventOutlinedIcon, featureRoute: COACH_FEATURE_ROUTES.Events };

const COACH_TABS: TabDefinition[] = [
  { key: "calendar", label: "Calendario", path: "/coach/convocations", icon: CalendarMonthOutlinedIcon, featureRoute: COACH_FEATURE_ROUTES.Convocations },
  EVENTS_TAB,
  { key: "trainings", label: "Entrenamientos", path: "/coach/trainings", icon: FitnessCenterOutlinedIcon, featureRoute: COACH_FEATURE_ROUTES.Trainings },
];

const PLAYER_TABS: TabDefinition[] = [
  { key: "results", label: "Resultados", path: "/coach/results", icon: ScoreboardOutlinedIcon, featureRoute: COACH_FEATURE_ROUTES.Convocations },
  { key: "classification", label: "Clasificación", path: "/coach/classification", icon: EmojiEventsOutlinedIcon, featureRoute: COACH_FEATURE_ROUTES.Convocations },
  EVENTS_TAB,
];

/**
 * Tabs of the Coach team navigation. Middle tabs depend on the role and are
 * dropped without feature access; "Inicio" and "Menú" are always present.
 * When the current page matches no tab, "Menú" is the active one: the page is
 * a section opened from the menu.
 */
export function buildTeamNavTabs({
  teamId,
  isPlayer,
  hasFeatureAccess,
  pathname,
}: TeamNavTabsInput): TeamNavTab[] {
  const middleTabs = (isPlayer ? PLAYER_TABS : COACH_TABS).filter(
    (tab) => !tab.featureRoute || hasFeatureAccess(tab.featureRoute),
  );
  const definitions = [HOME_TAB, ...middleTabs, MENU_TAB];
  const activeKey =
    definitions.find((tab) => matchesRoute(pathname, tab.path))?.key ?? MENU_TAB.key;

  return definitions.map((tab) => ({
    key: tab.key,
    label: tab.label,
    to: withTeamId(tab.path, teamId),
    icon: tab.icon,
    active: tab.key === activeKey,
  }));
}
