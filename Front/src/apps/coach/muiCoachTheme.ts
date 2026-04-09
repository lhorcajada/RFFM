import { createTheme } from "@mui/material/styles";

// Deep navy dark palette — coherent with squad card style
const coachTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#4d9de0",   // soft steel blue — readable on navy
      light: "#7ab8f5",
      contrastText: "#0d0d1f",
    },
    secondary: {
      main: "#4ec9b0",   // teal
      contrastText: "#0d0d1f",
    },
    background: {
      default: "#07071a", // very dark navy page background
      paper: "#1c1c30",   // card surfaces — contrast against dark bg
    },
    text: {
      primary: "#e8e8e8",           // near-white — PlayerCromo text
      secondary: "rgba(255,255,255,0.55)", // subtle muted
    },
    divider: "rgba(255,255,255,0.08)",
  },
  typography: {
    fontFamily: ['"Segoe UI"', '"Inter"', "Roboto", "sans-serif"].join(","),
    h1: { color: "#7ab8f5", fontWeight: 700 },
    h2: { color: "#7ab8f5", fontWeight: 700 },
    h3: { color: "#7ab8f5", fontWeight: 700 },
    h4: { color: "#7ab8f5", fontWeight: 700 },
    h5: { color: "#7ab8f5", fontWeight: 700 },
    h6: { color: "#a8d4f5", fontSize: "1rem", fontWeight: 600 },
    subtitle2: { color: "#a8d4f5", fontSize: "0.85rem", opacity: 0.95 },
    body2: { color: "#e8e8e8", fontSize: "0.9rem" },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#252545", // medium navy — squad gradient mid
          color: "#e8e8e8",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 6,
        },
        contained: {
          boxShadow: "none",
          backgroundColor: "#4d9de0",
          "&:hover": {
            backgroundColor: "#7ab8f5",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: "#1c1c30",
          color: "#e8e8e8",
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          color: "#e8e8e8",
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        ".rffm-coach-theme body": {
          backgroundColor: "#07071a",
          color: "#e8e8e8",
        },
        ".rffm-coach-theme": {
          "--rffm-gradient-bg":
            "linear-gradient(180deg, #07071a 0%, #0e0e26 100%)",
          "--rffm-card-bg": "#1c1c30",
          "--rffm-title-gradient":
            "linear-gradient(135deg, #4d9de0 0%, #4ec9b0 100%)",
          "--bg": "#07071a",
          "--rffm-primary": "#4d9de0",
          "--rffm-coach-dialog-text": "#e8e8e8",
        },
        ".rffm-coach-theme [data-coach-dialog] .MuiTypography-root, .rffm-coach-theme [data-coach-dialog] .MuiButton-root, .rffm-coach-theme [data-coach-dialog] .MuiDialogContent-root, .rffm-coach-theme [data-coach-dialog] .MuiDialogActions-root":
          {
            color: "var(--rffm-coach-dialog-text, #e8e8e8)",
          },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: "48px",
        },
      },
    },
  },
});

export default coachTheme;
