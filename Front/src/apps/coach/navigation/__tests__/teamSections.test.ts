import { describe, expect, it } from "vitest";
import { COACH_FEATURE_ROUTES } from "../../constants/featureRoutes";
import { buildTeamSections, type TeamSectionsInput } from "../teamSections";

const PLAYER_ALLOWED_ROUTES: string[] = [
  COACH_FEATURE_ROUTES.Squad,
  COACH_FEATURE_ROUTES.Events,
  COACH_FEATURE_ROUTES.AttendanceSummary,
  COACH_FEATURE_ROUTES.Convocations,
  COACH_FEATURE_ROUTES.Injured,
  COACH_FEATURE_ROUTES.Sanctions,
  COACH_FEATURE_ROUTES.Lottery,
  COACH_FEATURE_ROUTES.News,
  COACH_FEATURE_ROUTES.MyDocuments,
];

function build(overrides: Partial<TeamSectionsInput> = {}) {
  return buildTeamSections({
    teamId: null,
    isPlayer: false,
    hasFeatureAccess: () => true,
    ...overrides,
  });
}

function labels(input: Partial<TeamSectionsInput> = {}) {
  return build(input).flatMap((group) => group.items.map((item) => item.label));
}

function findItem(label: string, input: Partial<TeamSectionsInput> = {}) {
  return build(input)
    .flatMap((group) => group.items)
    .find((item) => item.label === label);
}

function groupOf(label: string, input: Partial<TeamSectionsInput> = {}) {
  return build(input).find((group) => group.items.some((item) => item.label === label))?.title;
}

describe("buildTeamSections — grupos", () => {
  it("devuelve los grupos en orden cuando todo es visible", () => {
    expect(build().map((group) => group.title)).toEqual([
      "Equipo",
      "Actividad",
      "Competición",
      "Disciplina",
      "Otros",
      "Cuenta",
    ]);
  });

  it("coloca Calendario, Resultados, Clasificación y Estadísticas de rivales en Competición", () => {
    expect(groupOf("Calendario")).toBe("Competición");
    expect(groupOf("Resultados")).toBe("Competición");
    expect(groupOf("Clasificación")).toBe("Competición");
    expect(groupOf("Estadísticas de rivales")).toBe("Competición");
  });

  it("omite un grupo cuando ninguna de sus entradas es visible", () => {
    const titles = build({
      hasFeatureAccess: (route) =>
        route !== COACH_FEATURE_ROUTES.Rivals &&
        route !== COACH_FEATURE_ROUTES.GameModel &&
        route !== COACH_FEATURE_ROUTES.Convocations,
    }).map((group) => group.title);

    expect(titles).not.toContain("Competición");
    expect(titles).toContain("Equipo");
  });
});

describe("buildTeamSections — rutas", () => {
  it("añade el teamId a las secciones del equipo", () => {
    expect(findItem("Plantilla", { teamId: "team-1" })?.to).toBe("/coach/squad?teamId=team-1");
    expect(findItem("Resultados", { teamId: "team-1" })?.to).toBe("/coach/results?teamId=team-1");
    expect(findItem("Clasificación", { teamId: "team-1" })?.to).toBe(
      "/coach/classification?teamId=team-1",
    );
    expect(findItem("Estadísticas de rivales", { teamId: "team-1" })?.to).toBe(
      "/coach/rival-stats?teamId=team-1",
    );
    expect(findItem("Gestión de usuarios", { teamId: "team-1" })?.to).toBe(
      "/coach/team-users?teamId=team-1",
    );
  });

  it("enlaza sin teamId cuando no hay equipo en contexto", () => {
    expect(findItem("Gestión de usuarios")?.to).toBe("/coach/team-users");
    expect(findItem("Plantilla")?.to).toBe("/coach/squad");
  });

  it("mantiene sin teamId las secciones que no dependen del equipo", () => {
    expect(findItem("Rivales", { teamId: "team-1" })?.to).toBe("/coach/rivals");
    expect(findItem("Noticias", { teamId: "team-1" })?.to).toBe("/coach/news");
    expect(findItem("Notificaciones", { teamId: "team-1" })?.to).toBe("/coach/notifications");
  });
});

describe("buildTeamSections — rol", () => {
  it("muestra Gestión de usuarios y Documentos solo a quien no es jugador", () => {
    expect(labels()).toEqual(expect.arrayContaining(["Gestión de usuarios", "Documentos"]));
    expect(labels({ isPlayer: true })).not.toContain("Gestión de usuarios");
    expect(labels({ isPlayer: true })).not.toContain("Documentos");
  });

  it("muestra Mis documentos solo al jugador con permiso", () => {
    expect(labels()).not.toContain("Mis documentos");
    expect(labels({ isPlayer: true })).toContain("Mis documentos");
    expect(
      labels({
        isPlayer: true,
        hasFeatureAccess: (route) => route !== COACH_FEATURE_ROUTES.MyDocuments,
      }),
    ).not.toContain("Mis documentos");
  });

  it("incluye en Cuenta Panel general y Configuración para el entrenador y Mi perfil para todos", () => {
    const coachAccount = build().find((group) => group.title === "Cuenta");
    const playerAccount = build({ isPlayer: true }).find((group) => group.title === "Cuenta");

    expect(coachAccount?.items.map((item) => item.label)).toEqual([
      "Panel general",
      "Configuración",
      "Mi perfil",
    ]);
    expect(playerAccount?.items.map((item) => item.label)).toEqual(["Mi perfil"]);
  });

  it("oculta Configuración sin permiso de configuración", () => {
    expect(
      labels({ hasFeatureAccess: (route) => route !== COACH_FEATURE_ROUTES.Settings }),
    ).not.toContain("Configuración");
  });
});

describe("buildTeamSections — permisos", () => {
  it("el jugador ve las secciones permitidas y no Rivales, Entrenamientos, Modelo de Juego ni Pruebas de acceso", () => {
    const visible = labels({
      isPlayer: true,
      hasFeatureAccess: (route) => PLAYER_ALLOWED_ROUTES.includes(route),
    });

    expect(visible).toEqual(
      expect.arrayContaining([
        "Plantilla",
        "Eventos",
        "Resumen de asistencias",
        "Calendario",
        "Lesionados",
        "Sanciones",
        "Lotería",
        "Noticias",
      ]),
    );
    expect(visible).not.toContain("Rivales");
    expect(visible).not.toContain("Entrenamientos");
    expect(visible).not.toContain("Modelo de Juego");
    expect(visible).not.toContain("Pruebas de acceso");
  });

  it("el entrenador con todos los permisos ve todas las secciones catalogadas", () => {
    expect(labels()).toEqual(
      expect.arrayContaining([
        "Rivales",
        "Entrenamientos",
        "Modelo de Juego",
        "Pruebas de acceso",
        "Normas del Equipo",
      ]),
    );
  });

  it("muestra Notificaciones aunque el usuario no tenga ningún permiso", () => {
    expect(labels({ hasFeatureAccess: () => false })).toContain("Notificaciones");
  });

  it("oculta Resultados, Clasificación y Estadísticas de rivales sin acceso al calendario", () => {
    const visible = labels({
      hasFeatureAccess: (route) => route !== COACH_FEATURE_ROUTES.Convocations,
    });

    expect(visible).not.toContain("Resultados");
    expect(visible).not.toContain("Clasificación");
    expect(visible).not.toContain("Estadísticas de rivales");
  });
});
