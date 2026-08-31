/**
 * Stable logical identifiers for Coach-app feature areas, mirroring
 * `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/CoachFeatureRoutes.cs`.
 *
 * These are NOT arbitrary strings — they must match the `featureRoute` values
 * returned by `GET /api/permissions/me` exactly, since `usePermissions().hasFeatureAccess`
 * compares against them directly.
 */
export const COACH_FEATURE_ROUTES = {
  // Allowed for Player (Read-only)
  Squad: "/coach/squad",
  Events: "/coach/attendance",
  AttendanceSummary: "/coach/attendance/summary",
  AttendanceConfirmation: "/mobile/attendance",
  Convocations: "/coach/convocations",
  Injured: "/coach/injured",
  Sanctions: "/coach/sanctions",
  Lottery: "/coach/lottery",
  News: "/coach/news",

  // Blocked for Player
  Rivals: "/coach/rivals",
  Trainings: "/coach/trainings",
  GameModel: "/coach/game-model",
  SeasonPlan: "/coach/season-plan",
  SeasonAccess: "/coach/season-access",
  Settings: "/coach/settings",
  ClubManagement: "/coach/clubs",
  ClubPlayers: "/coach/clubs/players",
  ClubTeams: "/coach/clubs/teams",
  ClubRegistrations: "/coach/clubs/registrations",

  // Read for every team member (any authenticated role); ReadWrite for Coach/Admin
  TeamRulesDocument: "/mobile/team-rules",
} as const;

export type CoachFeatureRoute = (typeof COACH_FEATURE_ROUTES)[keyof typeof COACH_FEATURE_ROUTES];
