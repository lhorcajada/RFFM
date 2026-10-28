const TEAM_NAV_ROUTES = [
  "/coach/team-dashboard",
  "/coach/menu",
  "/coach/team-users",
  "/coach/squad",
  "/coach/player",
  "/coach/injured",
  "/coach/attendance",
  "/coach/trainings",
  "/coach/convocations",
  "/coach/results",
  "/coach/classification",
  "/coach/rival-stats",
  "/coach/rivals",
  "/coach/game-model",
  "/coach/match-report",
  "/coach/team-rules",
  "/coach/sanctions",
  "/coach/my-documents",
  "/coach/player-documents",
  "/coach/news",
  "/coach/lottery",
  "/coach/quiniela",
  "/coach/season-access",
  "/coach/notifications",
];

export function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/** Whether the Coach team navigation is shown on this page. */
export function isTeamNavRoute(pathname: string): boolean {
  return TEAM_NAV_ROUTES.some((route) => matchesRoute(pathname, route));
}
