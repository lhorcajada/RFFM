import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import gameTheme from "./apps/federation/muiGameTheme";
import { BrowserRouter } from "react-router-dom";
import { UserProvider } from "./shared/context/UserContext";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={gameTheme}>
      <CssBaseline />
      <BrowserRouter>
        <UserProvider>
          <App />
        </UserProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
