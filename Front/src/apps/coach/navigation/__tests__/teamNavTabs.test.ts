import { describe, expect, it } from "vitest";
import { COACH_FEATURE_ROUTES } from "../../constants/featureRoutes";
import { buildTeamNavTabs, type TeamNavTabsInput } from "../teamNavTabs";

function build(overrides: Partial<TeamNavTabsInput> = {}) {
  return buildTeamNavTabs({
    teamId: null,
    isPlayer: false,
    hasFeatureAccess: () => true,
    pathname: "/coach/team-dashboard",
    ...overrides,
  });
}

function activeLabel(pathname: string, overrides: Partial<TeamNavTabsInput> = {}) {
  return build({ pathname, ...overrides }).find((tab) => tab.active)?.label;
}

describe("buildTeamNavTabs — pestañas por rol", () => {
  it("el entrenador ve Inicio, Calendario, Eventos, Entrenamientos y Menú", () => {
    expect(build().map((tab) => tab.label)).toEqual([
      "Inicio",
      "Calendario",
      "Eventos",
      "Entrenamientos",
      "Menú",
    ]);
  });

  it("el jugador o familiar ve Inicio, Resultados, Clasificación, Eventos y Menú", () => {
    expect(build({ isPlayer: true }).map((tab) => tab.label)).toEqual([
      "Inicio",
      "Resultados",
      "Clasificación",
      "Eventos",
      "Menú",
    ]);
  });
});

describe("buildTeamNavTabs — permisos", () => {
  it("oculta Entrenamientos sin permiso de entrenamientos", () => {
    const labels = build({
      hasFeatureAccess: (route) => route !== COACH_FEATURE_ROUTES.Trainings,
    }).map((tab) => tab.label);

    expect(labels).not.toContain("Entrenamientos");
  });

  it("oculta Resultados y Clasificación al jugador sin acceso al calendario", () => {
    const labels = build({
      isPlayer: true,
      hasFeatureAccess: (route) => route !== COACH_FEATURE_ROUTES.Convocations,
    }).map((tab) => tab.label);

    expect(labels).toEqual(["Inicio", "Eventos", "Menú"]);
  });

  it("mantiene siempre Inicio y Menú aunque no haya ningún permiso", () => {
    expect(build({ hasFeatureAccess: () => false }).map((tab) => tab.label)).toEqual([
      "Inicio",
      "Menú",
    ]);
  });
});

describe("buildTeamNavTabs — enlaces", () => {
  it("añade el teamId a todas las pestañas cuando hay equipo en contexto", () => {
    expect(build({ teamId: "team-1" }).map((tab) => tab.to)).toEqual([
      "/coach/team-dashboard?teamId=team-1",
      "/coach/convocations?teamId=team-1",
      "/coach/attendance?teamId=team-1",
      "/coach/trainings?teamId=team-1",
      "/coach/menu?teamId=team-1",
    ]);
  });

  it("enlaza sin teamId cuando no hay equipo en contexto", () => {
    expect(build().find((tab) => tab.label === "Inicio")?.to).toBe("/coach/team-dashboard");
  });
});

describe("buildTeamNavTabs — pestaña activa", () => {
  it("marca Inicio en el panel del equipo", () => {
    expect(activeLabel("/coach/team-dashboard")).toBe("Inicio");
  });

  it("marca Eventos en la lista de eventos y en sus subrutas", () => {
    expect(activeLabel("/coach/attendance")).toBe("Eventos");
    expect(activeLabel("/coach/attendance/abc")).toBe("Eventos");
  });

  it("marca Entrenamientos en sus subrutas", () => {
    expect(activeLabel("/coach/trainings/new-session")).toBe("Entrenamientos");
  });

  it("marca Menú en la página Menú", () => {
    expect(activeLabel("/coach/menu")).toBe("Menú");
  });

  it("marca Menú cuando la página no corresponde a ninguna pestaña", () => {
    expect(activeLabel("/coach/sanctions")).toBe("Menú");
    expect(activeLabel("/coach/results")).toBe("Menú");
  });

  it("marca Resultados al jugador en la página de resultados", () => {
    expect(activeLabel("/coach/results", { isPlayer: true })).toBe("Resultados");
  });

  it("marca una única pestaña", () => {
    expect(build({ pathname: "/coach/convocations/match" }).filter((tab) => tab.active)).toHaveLength(1);
  });
});
