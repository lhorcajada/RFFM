import { createTheme } from "@mui/material/styles";
import gameTheme from "./muiGameTheme";

// Dark-orange variant of the shared theme, active only in local development
// (see main.tsx) so developers can tell dev apart from other environments at a glance.
const devTheme = createTheme(gameTheme, {
  palette: {
    primary: {
      main: "#ff6a00",
      light: "#ff9d45",
      dark: "#b34700",
      contrastText: "#1a0900",
    },
    secondary: {
      main: "#ff9800",
      light: "#ffc046",
      dark: "#c66900",
      contrastText: "#1a0900",
    },
    background: {
      default: "#170a02",
      paper: "#2b1404",
    },
    text: {
      primary: "#fff3e8",
      secondary: "rgba(255, 224, 191, 0.72)",
    },
    divider: "rgba(255, 106, 0, 0.15)",
    info: {
      main: "#ff9800",
      contrastText: "#1a0900",
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(23, 10, 2, 0.95)",
          backgroundImage:
            "linear-gradient(to bottom, rgba(255, 106, 0, 0.14), rgba(0, 0, 0, 0.3))",
          borderBottom: "2px solid rgba(255, 106, 0, 0.3)",
          boxShadow:
            "0 4px 20px rgba(255, 106, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        ":root": {
          "--rffm-gradient-bg":
            "linear-gradient(135deg, #170a02 0%, #2b1404 50%, #170a02 100%)",
          "--rffm-card-bg": "#2b1404",
          "--rffm-title-gradient":
            "linear-gradient(135deg, #ff6a00 0%, #ffc046 50%, #ff9800 100%)",
          "--rffm-primary": "#ff6a00",
          "--rffm-secondary": "#ff9800",
          "--bg": "#170a02",
          "--rffm-dash-card-bg": "#2b1404",
          "--rffm-dash-accent": "#ff6a00",
          "--rffm-dash-card-text": "#fff3e8",
          "--rffm-dash-desc-text": "rgba(255, 224, 191, 0.65)",
          "--rffm-dash-card-border": "rgba(255, 106, 0, 0.22)",
          "--rffm-glow-cyan": "0 0 20px rgba(255, 106, 0, 0.4)",
          "--rffm-glow-gold": "0 0 20px rgba(255, 152, 0, 0.4)",
        },
        body: {
          backgroundImage:
            "linear-gradient(135deg, #170a02 0%, #2b1404 50%, #170a02 100%)",
          backgroundAttachment: "fixed",
        },
      },
    },
  },
});

export default devTheme;
