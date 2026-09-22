import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./shared/i18n/i18n";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import gameTheme from "./apps/federation/muiGameTheme";
import devTheme from "./apps/federation/muiDevTheme";
import { BrowserRouter } from "react-router-dom";
import { UserProvider } from "./shared/context/UserContext";
import { RffmSeasonProvider } from "./shared/context/RffmSeasonContext";

// Polyfill Node-style `global` for browser/worker contexts.
// Some CJS bundles still read `global` and fail if it is missing.
const runtimeGlobal = globalThis as any;
if (typeof runtimeGlobal.global === "undefined") {
  runtimeGlobal.global = runtimeGlobal;
}

if (import.meta.env.DEV) {
  document.title = "Futbol Base (Entorno Desarrollo)";
}

const activeTheme = import.meta.env.DEV ? devTheme : gameTheme;

// Force Emotion (used internally by MUI) to always insert its styles right after
// this meta tag, i.e. at the very top of <head>. Without this, the relative order
// of MUI's injected styles vs. our CSS Modules is non-deterministic — it depends on
// component mount timing — so lazy-loaded routes can end up with MUI styles winning
// the cascade over same-specificity CSS Module rules (e.g. BottomMenu's arrow buttons
// staying visible/mispositioned until a full page reload).
const emotionInsertionPoint = document.querySelector<HTMLMetaElement>(
  'meta[name="emotion-insertion-point"]'
);
const emotionCache = createCache({
  key: "css",
  insertionPoint: emotionInsertionPoint ?? undefined,
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CacheProvider value={emotionCache}>
      <ThemeProvider theme={activeTheme}>
        <CssBaseline />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <UserProvider>
            <RffmSeasonProvider>
              <App />
            </RffmSeasonProvider>
          </UserProvider>
        </BrowserRouter>
      </ThemeProvider>
    </CacheProvider>
  </React.StrictMode>
);
