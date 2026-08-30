import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { CircularProgress, Box } from "@mui/material";
import { useLayoutEffect } from "react";
import { CoachAuthProvider, CoachAuthGuard } from "./context/CoachAuthContext";
import { RequireFeaturePermission } from "./components/RequireFeaturePermission";
import { COACH_FEATURE_ROUTES } from "./constants/featureRoutes";
import Clubs from "./pages/clubs/clubs";
const ClubsDashboard = lazy(() => import("./pages/clubs/dashboard/Dashboard"));
const ClubPlayerRegistrations = lazy(() => import("./pages/clubs/registrations/PlayerRegistrations"));
const ClubPlayers = lazy(() => import("./pages/clubs/players/ClubPlayers"));
const ClubTeams = lazy(() => import("./pages/clubTeams/ClubTeams"));
import React from "react";

// Placeholder pages for Coach app
const Dashboard = lazy(() => import("./pages/Dashboard/Dashboard"));
const TeamDashboard = lazy(() => import("./pages/team-dashboard/TeamDashboard"));
// Auth pages are provided at top-level shared/pages/auth; coach redirects to those routes

// Feature pages for Coach app
const Settings = lazy(() => import("./pages/settings/Settings"));
const News = lazy(() => import("./pages/news/News"));
const Squad = lazy(() => import("./pages/squad/Squad"));
const NewPlayer = lazy(() => import("./pages/squad/new/NewPlayer"));
const PlayersClub = lazy(() => import("./pages/squad/PlayersClub/PlayersClub"));
const Attendance = lazy(() => import("./pages/attendance/Attendance"));
const AttendanceEvent = lazy(
  () => import("./pages/attendance/AttendanceEvent"),
);
const AttendanceSummary = lazy(() => import("./pages/attendance/AttendanceSummary"));
const Convocations = lazy(() => import("./pages/convocations/Convocations"));
const ConvocationMatchDetail = lazy(() => import("./pages/convocations/ConvocationMatchDetail"));
const Trainings = lazy(() => import("./pages/trainings/Trainings"));
const NewExercisePage = lazy(() => import("./pages/trainings/new/NewExercisePage"));
const NewSessionPage = lazy(() => import("./pages/trainings/new-session/NewSessionPage"));
const Injured = lazy(() => import("./pages/injured/Injured"));
const GameModel = lazy(() => import("./pages/game-model/GameModel"));
const GameModelCreate = lazy(() => import("./pages/game-model/GameModelCreate"));
const TeamRules = lazy(() => import("./pages/team-rules/TeamRules"));
const TeamRulesEdit = lazy(() => import("./pages/team-rules/TeamRulesEdit"));
const TeamUsers = lazy(() => import("./pages/team-users/TeamUsers"));
const Sanctions = lazy(() => import("./pages/sanctions/Sanctions"));
const Lottery = lazy(() => import("./pages/lottery/Lottery"));
const Rivals = lazy(() => import("./pages/rivals/Rivals"));
const SeasonAccess = lazy(() => import("./pages/season-access/SeasonAccess"));
const PrepareTests = lazy(() => import("./pages/season-access/prepare/PrepareTestsPage"));
const PlayerDetail = lazy(() => import("./pages/player/PlayerDetail"));
const NewRatingPage = lazy(() => import("./pages/squad/rating/NewRatingPage"));
const RatingHistoryPage = lazy(() => import("./pages/squad/rating/RatingHistoryPage"));
const RatingEvolutionPage = lazy(() => import("./pages/squad/rating/RatingEvolutionPage"));

function LoadingFallback() {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
      }}
    >
      <CircularProgress />
    </Box>
  );
}

function CoachRoutesContent() {
  // FC26 unified theme: no CSS var overrides needed — gameTheme CssBaseline
  // at root level already sets all --rffm-* custom properties correctly.
  useLayoutEffect(() => {
    return () => {};
  }, []);
  return (
    <CoachAuthGuard>
      <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Navigate to="login" replace />} />
            <Route path="login" element={<Navigate to="/login" replace />} />
            <Route
              path="register"
              element={<Navigate to="/register" replace />}
            />
            <Route
              path="forgot-password"
              element={<Navigate to="/forgot-password" replace />}
            />
            <Route
              path="reset-password"
              element={<Navigate to="/reset-password" replace />}
            />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="team-dashboard" element={<TeamDashboard />} />
            <Route path="team-users" element={<TeamUsers />} />
            <Route
              path="settings"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.Settings}>
                  <Settings />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="news"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.News}>
                  <News />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="squad"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.Squad}>
                  <Squad />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="squad/new"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.Squad}>
                  <NewPlayer />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="squad/players-club"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.Squad}>
                  <PlayersClub />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="squad/:playerId/rating/new"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.Squad}>
                  <NewRatingPage />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="squad/:playerId/rating/history"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.Squad}>
                  <RatingHistoryPage />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="squad/:playerId/rating/evolution"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.Squad}>
                  <RatingEvolutionPage />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="player/:id"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.Squad}>
                  <PlayerDetail />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="attendance"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.Events}>
                  <Attendance />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="attendance/:id"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.Events}>
                  <AttendanceEvent />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="attendance/summary"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.AttendanceSummary}>
                  <AttendanceSummary />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="convocations"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.Convocations}>
                  <Convocations />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="convocations/match"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.Convocations}>
                  <ConvocationMatchDetail />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="trainings"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.Trainings}>
                  <Trainings />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="trainings/new-exercise"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.Trainings}>
                  <NewExercisePage />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="trainings/new-session"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.Trainings}>
                  <NewSessionPage />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="injured"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.Injured}>
                  <Injured />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="game-model"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.GameModel}>
                  <GameModel />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="game-model/create"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.GameModel}>
                  <GameModelCreate />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="game-model/edit"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.GameModel}>
                  <GameModelCreate />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="team-rules"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.TeamRulesDocument}>
                  <TeamRules />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="team-rules/edit"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.TeamRulesDocument}>
                  <TeamRulesEdit />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="sanctions"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.Sanctions}>
                  <Sanctions />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="lottery"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.Lottery}>
                  <Lottery />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="rivals"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.Rivals}>
                  <Rivals />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="season-access"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.SeasonAccess}>
                  <SeasonAccess />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="season-access/prepare"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.SeasonAccess}>
                  <PrepareTests />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="clubs"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.ClubManagement}>
                  <Clubs />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="clubs/dashboard/:id"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.ClubManagement}>
                  <ClubsDashboard />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="clubs/:id/players"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.ClubPlayers}>
                  <ClubPlayers />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="clubs/:id/registrations"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.ClubRegistrations}>
                  <ClubPlayerRegistrations />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="clubs/:id/teams"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.ClubTeams}>
                  <ClubTeams />
                </RequireFeaturePermission>
              }
            />
            <Route
              path="clubs/:id/teams/new"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.ClubTeams}>
                  {React.createElement(
                    React.lazy(() => import("./pages/clubTeams/create/CreateTeam")),
                  )}
                </RequireFeaturePermission>
              }
            />
            <Route
              path="clubs/:id/teams/:teamId/edit"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.ClubTeams}>
                  {React.createElement(
                    React.lazy(() => import("./pages/clubTeams/edit/EditTeam")),
                  )}
                </RequireFeaturePermission>
              }
            />
            <Route
              path="clubs/new"
              element={
                <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.ClubManagement}>
                  {React.createElement(
                    React.lazy(() => import("./pages/clubs/create/CreateClub")),
                  )}
                </RequireFeaturePermission>
              }
            />
          </Routes>
        </Suspense>
    </CoachAuthGuard>
  );
}

export default function CoachRoutes() {
  return (
    <CoachAuthProvider>
      <CoachRoutesContent />
    </CoachAuthProvider>
  );
}
