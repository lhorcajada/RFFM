import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { CircularProgress, Box } from "@mui/material";
import { CoachAuthProvider, CoachAuthGuard } from "./context/CoachAuthContext";

// Placeholder pages for Coach app
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CoachLogin = lazy(() => import("./pages/auth/login/Login"));
const CoachRegister = lazy(() => import("./pages/auth/register/Register"));
const CoachForgotPassword = lazy(
  () => import("./pages/auth/forgot-password/ForgotPassword")
);
const CoachResetPassword = lazy(
  () => import("./pages/auth/reset-password/ResetPassword")
);

// Feature pages for Coach app
const Settings = lazy(() => import("./pages/settings/Settings"));
const News = lazy(() => import("./pages/news/News"));
const Squad = lazy(() => import("./pages/squad/Squad"));
const Attendance = lazy(() => import("./pages/attendance/Attendance"));
const Convocations = lazy(() => import("./pages/convocations/Convocations"));
const Matches = lazy(() => import("./pages/matches/Matches"));
const Trainings = lazy(() => import("./pages/trainings/Trainings"));
const Injured = lazy(() => import("./pages/injured/Injured"));
const GameModel = lazy(() => import("./pages/game-model/GameModel"));
const Sanctions = lazy(() => import("./pages/sanctions/Sanctions"));
const Lottery = lazy(() => import("./pages/lottery/Lottery"));

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
  return (
    <CoachAuthGuard>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="login" replace />} />
          <Route path="login" element={<CoachLogin />} />
          <Route path="register" element={<CoachRegister />} />
          <Route path="forgot-password" element={<CoachForgotPassword />} />
          <Route path="reset-password" element={<CoachResetPassword />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="settings" element={<Settings />} />
          <Route path="news" element={<News />} />
          <Route path="squad" element={<Squad />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="convocations" element={<Convocations />} />
          <Route path="matches" element={<Matches />} />
          <Route path="trainings" element={<Trainings />} />
          <Route path="injured" element={<Injured />} />
          <Route path="game-model" element={<GameModel />} />
          <Route path="sanctions" element={<Sanctions />} />
          <Route path="lottery" element={<Lottery />} />
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
