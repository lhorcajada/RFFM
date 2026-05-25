import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import gameTheme from "./apps/federation/muiGameTheme";
import { BrowserRouter } from "react-router-dom";
import { UserProvider } from "./shared/context/UserContext";

// Polyfills for libraries that assume a Node-like `global` variable.
// Some third-party packages (bundled for Node) access `global` instead of `globalThis`.
// Provide a minimal mapping so those libs run in the browser.
if (typeof (window as any).global === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).global = window as any;
}
// also ensure globalThis.global is available
if (typeof (globalThis as any).global === 'undefined') {
  (globalThis as any).global = globalThis;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={gameTheme}>
      <CssBaseline />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <UserProvider>
          <App />
        </UserProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
