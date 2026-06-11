import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { CircularProgress, Box } from "@mui/material";
import { useLayoutEffect } from "react";
import { CoachAuthProvider, CoachAuthGuard } from "./context/CoachAuthContext";
import Clubs from "./pages/clubs/clubs";
const ClubsDashboard = lazy(() => import("./pages/clubs/dashboard/Dashboard"));
const ClubPlayerRegistrations = lazy(() => import("./pages/clubs/registrations/PlayerRegistrations"));
const ClubPlayers = lazy(() => import("./pages/clubs/players/ClubPlayers"));
const ClubTeams = lazy(() => import("./pages/clubTeams/ClubTeams"));
import React from "react";

// Placeholder pages for Coach app
const Dashboard = lazy(() => import("./pages/Dashboard/Dashboard"));
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
const Injured = lazy(() => import("./pages/injured/Injured"));
const GameModel = lazy(() => import("./pages/game-model/GameModel"));
const GameModelCreate = lazy(() => import("./pages/game-model/GameModelCreate"));
const CreateSessionFromSubPrinciple = lazy(() => import("./pages/game-model/CreateSessionFromSubPrinciple"));
const SessionsFromSubPrinciple = lazy(() => import("./pages/game-model/SessionsFromSubPrinciple"));
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
            <Route path="settings" element={<Settings />} />
            <Route path="news" element={<News />} />
            <Route path="squad" element={<Squad />} />
            <Route path="squad/new" element={<NewPlayer />} />
            <Route path="squad/players-club" element={<PlayersClub />} />
            <Route path="squad/:playerId/rating/new" element={<NewRatingPage />} />
            <Route path="squad/:playerId/rating/history" element={<RatingHistoryPage />} />
            <Route path="squad/:playerId/rating/evolution" element={<RatingEvolutionPage />} />
            <Route path="player/:id" element={<PlayerDetail />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="attendance/:id" element={<AttendanceEvent />} />
            <Route path="attendance/summary" element={<AttendanceSummary />} />
            <Route path="convocations" element={<Convocations />} />
            <Route path="convocations/match" element={<ConvocationMatchDetail />} />
            <Route path="trainings" element={<Trainings />} />
            <Route path="trainings/new-exercise" element={<NewExercisePage />} />
            <Route path="injured" element={<Injured />} />
            <Route path="game-model" element={<GameModel />} />
            <Route path="game-model/create" element={<GameModelCreate />} />
            <Route path="game-model/edit" element={<GameModelCreate />} />
            <Route path="game-model/create-session" element={<CreateSessionFromSubPrinciple />} />
            <Route path="game-model/sessions" element={<SessionsFromSubPrinciple />} />
            <Route path="sanctions" element={<Sanctions />} />
            <Route path="lottery" element={<Lottery />} />
            <Route path="rivals" element={<Rivals />} />
            <Route path="season-access" element={<SeasonAccess />} />
            <Route path="season-access/prepare" element={<PrepareTests />} />
            <Route path="clubs" element={<Clubs />} />
            <Route path="clubs/dashboard/:id" element={<ClubsDashboard />} />
            <Route path="clubs/:id/players" element={<ClubPlayers />} />
            <Route path="clubs/:id/registrations" element={<ClubPlayerRegistrations />} />
            <Route path="clubs/:id/teams" element={<ClubTeams />} />
            <Route
              path="clubs/:id/teams/new"
              element={React.createElement(
                React.lazy(() => import("./pages/clubTeams/create/CreateTeam")),
              )}
            />
            <Route
              path="clubs/:id/teams/:teamId/edit"
              element={React.createElement(
                React.lazy(() => import("./pages/clubTeams/edit/EditTeam")),
              )}
            />
            <Route
              path="clubs/new"
              element={React.createElement(
                React.lazy(() => import("./pages/clubs/create/CreateClub")),
              )}
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
