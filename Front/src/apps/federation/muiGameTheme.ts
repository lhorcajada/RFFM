import { createTheme } from "@mui/material/styles";

// ─── EA FC 26 unified theme ───────────────────────────────────────────────────
// Used by AppSelector, Federation, and Coach — single source of truth.
// Key colours:
//   Electric blue  #00c8ff  (primary)
//   Gold           #f5b800  (secondary)
//   Deep navy      #040d1a  (background)
//   Card surface   #071829
// ─────────────────────────────────────────────────────────────────────────────
const gameTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#00c8ff",
      light: "#4dd9ff",
      dark: "#0099cc",
      contrastText: "#040d1a",
    },
    secondary: {
      main: "#f5b800",
      light: "#ffd54f",
      dark: "#c68600",
      contrastText: "#040d1a",
    },
    background: {
      default: "#040d1a",
      paper: "#071829",
    },
    text: {
      primary: "#f0f8ff",
      secondary: "rgba(200, 230, 255, 0.65)",
    },
    divider: "rgba(0, 200, 255, 0.12)",
    info: {
      main: "#f5b800",
      contrastText: "#040d1a",
    },
    error: { main: "#ff4d4d" },
    success: { main: "#00e676" },
  },
  typography: {
    fontFamily: ['"Oswald"', '"Segoe UI"', "Roboto", "sans-serif"].join(","),
    h1: { fontWeight: 700, letterSpacing: "0.02em" },
    h2: { fontWeight: 700, letterSpacing: "0.02em" },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontSize: "1rem", fontWeight: 600, letterSpacing: "0.06em" },
    subtitle2: { fontSize: "0.82rem", opacity: 0.9 },
    body2: { fontSize: "0.85rem" },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage:
            "linear-gradient(180deg, rgba(0,200,255,0.03), rgba(0,0,0,0.15))",
          border: "1px solid rgba(0, 200, 255, 0.12)",
          borderRadius: 4,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#040d1a",
          backgroundImage: "none",
          borderBottom: "1px solid rgba(0, 200, 255, 0.2)",
          boxShadow: "none",
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {},
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "uppercase",
          fontFamily: '"Oswald", sans-serif',
          fontWeight: 600,
          letterSpacing: "0.08em",
          borderRadius: 4,
          boxShadow: "none",
        },
        contained: {
          backgroundColor: "#00c8ff",
          color: "#040d1a",
          "&:hover": {
            backgroundColor: "#4dd9ff",
            boxShadow: "0 0 16px rgba(0, 200, 255, 0.45)",
          },
        },
        outlined: {
          borderColor: "rgba(0, 200, 255, 0.45)",
          color: "#00c8ff",
          "&:hover": {
            borderColor: "#00c8ff",
            boxShadow: "0 0 8px rgba(0, 200, 255, 0.3)",
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: "#071829",
          backgroundImage:
            "linear-gradient(180deg, rgba(0,200,255,0.04), rgba(0,0,0,0.2))",
          border: "1px solid rgba(0, 200, 255, 0.15)",
          borderRadius: 4,
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: "56px",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(0, 200, 255, 0.35)",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#00c8ff",
            borderWidth: 1,
          },
        },
        input: {
          padding: "16px 14px",
          "&:-webkit-autofill": {
            WebkitBoxShadow: "0 0 0 1000px #071829 inset !important",
            WebkitTextFillColor: "#f0f8ff !important",
            caretColor: "#f0f8ff",
          },
          "&:-webkit-autofill:focus": {
            WebkitBoxShadow: "0 0 0 1000px #071829 inset !important",
            WebkitTextFillColor: "#f0f8ff !important",
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: { color: "#00c8ff" },
        select: { color: "#f0f8ff" },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: "rgba(200, 230, 255, 0.7)",
          "&.Mui-focused": { color: "#00c8ff" },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: "rgba(0, 200, 255, 0.12)" },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        ":root": {
          // FC26 CSS custom properties — shared by all apps
          "--rffm-gradient-bg":
            "linear-gradient(180deg, #040d1a 0%, #071829 100%)",
          "--rffm-card-bg": "#071829",
          "--rffm-title-gradient":
            "linear-gradient(135deg, #00c8ff 0%, #f5b800 100%)",
          "--rffm-primary": "#00c8ff",
          "--rffm-secondary": "#f5b800",
          "--bg": "#040d1a",
          "--rffm-footer-border": "1px solid rgba(0, 200, 255, 0.15)",
          // dashboard card vars
          "--rffm-dash-card-bg": "#071829",
          "--rffm-dash-accent": "#00c8ff",
          "--rffm-dash-card-text": "#f0f8ff",
          "--rffm-dash-desc-text": "rgba(200, 230, 255, 0.55)",
          // coach compat vars
          "--rffm-coach-dialog-text": "#f0f8ff",
        },
      },
    },
  },
});

export default gameTheme;
