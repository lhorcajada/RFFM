import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { CircularProgress, Box } from "@mui/material";

const FederationApp = lazy(() => import("../../apps/federation/routes"));
const CoachApp = lazy(() => import("../../apps/coach/routes"));
const AppSelector = lazy(() => import("./AppSelector"));
const Error500 = lazy(
  () => import("../../shared/components/ui/Error500/Error500")
);

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
      <CircularProgress size={60} />
    </Box>
  );
}

export default function AppRouter() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<AppSelector />} />
        <Route path="/federation/*" element={<FederationApp />} />
        <Route path="/coach/*" element={<CoachApp />} />
        <Route path="/error-500" element={<Error500 />} />
      </Routes>
    </Suspense>
  );
}
