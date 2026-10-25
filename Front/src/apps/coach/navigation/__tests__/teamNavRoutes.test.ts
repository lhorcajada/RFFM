import { describe, expect, it } from "vitest";
import { isTeamNavRoute } from "../teamNavRoutes";

describe("isTeamNavRoute", () => {
  it.each([
    "/coach/team-dashboard",
    "/coach/menu",
    "/coach/squad",
    "/coach/squad/new",
    "/coach/attendance/summary",
    "/coach/trainings/content-board",
    "/coach/convocations/match",
    "/coach/results",
    "/coach/classification",
    "/coach/rival-stats/simulation",
    "/coach/rivals",
    "/coach/news/123",
    "/coach/notifications",
    "/coach/player/abc",
  ])("muestra la navegación del equipo en %s", (pathname) => {
    expect(isTeamNavRoute(pathname)).toBe(true);
  });

  it.each([
    "/coach/dashboard",
    "/coach/settings",
    "/coach/clubs",
    "/coach/clubs/dashboard/1",
    "/coach/audit-log",
    "/federation/dashboard",
    "/profile",
  ])("no muestra la navegación del equipo en %s", (pathname) => {
    expect(isTeamNavRoute(pathname)).toBe(false);
  });

  it("compara por segmento completo y no por prefijo de texto", () => {
    expect(isTeamNavRoute("/coach/squadron")).toBe(false);
    expect(isTeamNavRoute("/coach/menus")).toBe(false);
  });
});
