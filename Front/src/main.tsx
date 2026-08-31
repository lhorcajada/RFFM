import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./shared/i18n/i18n";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import gameTheme from "./apps/federation/muiGameTheme";
import devTheme from "./apps/federation/muiDevTheme";
import { BrowserRouter } from "react-router-dom";
import { UserProvider } from "./shared/context/UserContext";

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

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={activeTheme}>
      <CssBaseline />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <UserProvider>
          <App />
        </UserProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
