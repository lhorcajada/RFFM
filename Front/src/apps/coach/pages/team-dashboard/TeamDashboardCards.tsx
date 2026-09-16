import { Fragment } from "react";
import LauncherTile from "./components/LauncherTile";
import {
  UsersManagementIllustration,
  SquadIllustration,
  EventsIllustration,
  AttendanceSummaryIllustration,
  MatchesIllustration,
  RivalsIllustration,
  TrainingsIllustration,
  InjuredIllustration,
  GameModelIllustration,
  TeamRulesIllustration,
  SanctionsIllustration,
  LotteryIllustration,
  NewsIllustration,
  SeasonAccessIllustration,
} from "./components/tileIllustrations";
import type { TeamResponse } from "../../services/teamService";
import { usePermissions } from "../../../../shared/hooks/usePermissions";
import { COACH_FEATURE_ROUTES } from "../../constants/featureRoutes";
import styles from "./TeamDashboardCards.module.css";

interface TeamDashboardCardsProps {
  team: TeamResponse | null;
  selectedSeason: string;
  isPlayer?: boolean;
}

/**
 * Renders the quick-access LauncherTiles, grouped under section headers
 * ("Equipo", "Actividad", "Competición", "Disciplina", "Otros") — no
 * wrapping grid element of its own. TeamDashboard.tsx wraps this in
 * `.tilesGrid` (TeamDashboard.module.css); each header spans the full grid
 * width (`grid-column: 1 / -1` in TeamDashboardCards.module.css) so it
 * starts a new row on both the mobile 2-column grid and the desktop dense
 * grid, and a group is skipped entirely when none of its tiles are visible
 * for the current role/permissions.
 */
export default function TeamDashboardCards({
  team,
  selectedSeason,
  isPlayer,
}: TeamDashboardCardsProps) {
  const seasonParam = selectedSeason ? `?seasonId=${selectedSeason}` : "";
  const seasonSuffix = selectedSeason ? `&seasonId=${selectedSeason}` : "";

  const { hasFeatureAccess } = usePermissions();

  const groups: { title: string; tiles: { key: string; visible: boolean; node: JSX.Element }[] }[] = [
    {
      title: "Equipo",
      tiles: [
        {
          key: "team-users",
          visible: !isPlayer,
          node: (
            <LauncherTile
              title="Gestión de usuarios"
              illustration={<UsersManagementIllustration />}
              gradient="linear-gradient(135deg, #37474f 0%, #455a64 50%, #263238 100%)"
              to={team?.id ? `/coach/team-users?teamId=${team.id}` : "/coach/team-users"}
            />
          ),
        },
        {
          key: "squad",
          visible: hasFeatureAccess(COACH_FEATURE_ROUTES.Squad),
          node: (
            <LauncherTile
              title="Plantilla"
              illustration={<SquadIllustration />}
              gradient="linear-gradient(135deg, #1b5e20 0%, #2e7d32 50%, #145214 100%)"
              to={
                team?.id
                  ? `/coach/squad?teamId=${team.id}${seasonSuffix}`
                  : `/coach/squad${seasonParam}`
              }
            />
          ),
        },
        {
          key: "injured",
          visible: hasFeatureAccess(COACH_FEATURE_ROUTES.Injured),
          node: (
            <LauncherTile
              title="Lesionados"
              illustration={<InjuredIllustration />}
              gradient="linear-gradient(135deg, #ad1457 0%, #c2185b 50%, #880e4f 100%)"
              to={team?.id ? `/coach/injured?teamId=${team.id}` : "/coach/injured"}
            />
          ),
        },
      ],
    },
    {
      title: "Actividad",
      tiles: [
        {
          key: "events",
          visible: hasFeatureAccess(COACH_FEATURE_ROUTES.Events),
          node: (
            <LauncherTile
              title="Eventos"
              illustration={<EventsIllustration />}
              gradient="linear-gradient(135deg, #0d47a1 0%, #1565c0 50%, #0a3880 100%)"
              to={
                team?.id
                  ? `/coach/attendance?teamId=${team.id}${seasonSuffix}`
                  : `/coach/attendance${seasonParam}`
              }
            />
          ),
        },
        {
          key: "trainings",
          visible: hasFeatureAccess(COACH_FEATURE_ROUTES.Trainings),
          node: (
            <LauncherTile
              title="Entrenamientos"
              illustration={<TrainingsIllustration />}
              gradient="linear-gradient(135deg, #2e7d32 0%, #43a047 50%, #1b5e20 100%)"
              to={team?.id ? `/coach/trainings?teamId=${team.id}` : "/coach/trainings"}
            />
          ),
        },
        {
          key: "convocations",
          visible: hasFeatureAccess(COACH_FEATURE_ROUTES.Convocations),
          node: (
            <LauncherTile
              title="Partidos"
              illustration={<MatchesIllustration />}
              gradient="linear-gradient(135deg, #b71c1c 0%, #c62828 50%, #9c1515 100%)"
              to={team?.id ? `/coach/convocations?teamId=${team.id}` : "/coach/convocations"}
            />
          ),
        },
        {
          key: "attendance-summary",
          visible: hasFeatureAccess(COACH_FEATURE_ROUTES.AttendanceSummary),
          node: (
            <LauncherTile
              title="Resumen de asistencias"
              illustration={<AttendanceSummaryIllustration />}
              gradient="linear-gradient(135deg, #00695c 0%, #00897b 50%, #004d40 100%)"
              to={
                team?.id
                  ? `/coach/attendance/summary?teamId=${team.id}${seasonSuffix}`
                  : `/coach/attendance/summary${seasonParam}`
              }
            />
          ),
        },
      ],
    },
    {
      title: "Competición",
      tiles: [
        {
          key: "rivals",
          visible: hasFeatureAccess(COACH_FEATURE_ROUTES.Rivals),
          node: (
            <LauncherTile
              title="Rivales"
              illustration={<RivalsIllustration />}
              gradient="linear-gradient(135deg, #e65100 0%, #ef6c00 50%, #bf360c 100%)"
              to="/coach/rivals"
            />
          ),
        },
        {
          key: "game-model",
          visible: hasFeatureAccess(COACH_FEATURE_ROUTES.GameModel),
          node: (
            <LauncherTile
              title="Modelo de Juego"
              illustration={<GameModelIllustration />}
              gradient="linear-gradient(135deg, #4527a0 0%, #5e35b1 50%, #311b92 100%)"
              to={team?.id ? `/coach/game-model?teamId=${team.id}` : "/coach/game-model"}
            />
          ),
        },
      ],
    },
    {
      title: "Disciplina",
      tiles: [
        {
          key: "team-rules",
          visible: hasFeatureAccess(COACH_FEATURE_ROUTES.TeamRulesDocument),
          node: (
            <LauncherTile
              title="Normas del Equipo"
              illustration={<TeamRulesIllustration />}
              gradient="linear-gradient(135deg, #4e342e 0%, #6d4c41 50%, #3e2723 100%)"
              to={team?.id ? `/coach/team-rules?teamId=${team.id}` : "/coach/team-rules"}
            />
          ),
        },
        {
          key: "sanctions",
          visible: hasFeatureAccess(COACH_FEATURE_ROUTES.Sanctions),
          node: (
            <LauncherTile
              title="Sanciones"
              illustration={<SanctionsIllustration />}
              gradient="linear-gradient(135deg, #7f0000 0%, #a30000 50%, #5c0000 100%)"
              to={team?.id ? `/coach/sanctions?teamId=${team.id}` : "/coach/sanctions"}
            />
          ),
        },
      ],
    },
    {
      title: "Otros",
      tiles: [
        {
          key: "news",
          visible: hasFeatureAccess(COACH_FEATURE_ROUTES.News),
          node: (
            <LauncherTile
              title="Noticias"
              illustration={<NewsIllustration />}
              gradient="linear-gradient(135deg, #01579b 0%, #0277bd 50%, #013a63 100%)"
              to="/coach/news"
            />
          ),
        },
        {
          key: "lottery",
          visible: hasFeatureAccess(COACH_FEATURE_ROUTES.Lottery),
          node: (
            <LauncherTile
              title="Lotería"
              illustration={<LotteryIllustration />}
              gradient="linear-gradient(135deg, #f57f17 0%, #f9a825 50%, #e65100 100%)"
              to="/coach/lottery"
            />
          ),
        },
        {
          key: "season-access",
          visible: hasFeatureAccess(COACH_FEATURE_ROUTES.SeasonAccess),
          node: (
            <LauncherTile
              title="Pruebas de acceso"
              illustration={<SeasonAccessIllustration />}
              gradient="linear-gradient(135deg, #006064 0%, #00838f 50%, #004d40 100%)"
              to="/coach/season-access"
            />
          ),
        },
      ],
    },
  ];

  return (
    <>
      {groups.map((group) => {
        const visibleTiles = group.tiles.filter((tile) => tile.visible);
        if (visibleTiles.length === 0) {
          return null;
        }
        return (
          <Fragment key={group.title}>
            <h3 className={styles.groupHeader}>{group.title}</h3>
            {visibleTiles.map((tile) => (
              <Fragment key={tile.key}>{tile.node}</Fragment>
            ))}
          </Fragment>
        );
      })}
    </>
  );
}
