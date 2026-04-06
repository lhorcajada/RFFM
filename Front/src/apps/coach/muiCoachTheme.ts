import { createTheme } from "@mui/material/styles";

// VS Code Dark+ palette
const coachTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#007ACC", // VS Code focus blue
      light: "#0098FF",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#4ec9b0", // VS Code type teal
      contrastText: "#1e1e1e",
    },
    background: {
      default: "#1e1e1e", // VS Code editor background
      paper: "#252526",   // VS Code sidebar background
    },
    text: {
      primary: "#d4d4d4",   // VS Code default text
      secondary: "#9cdcfe", // VS Code variable names (light blue)
    },
    divider: "rgba(255,255,255,0.08)",
  },
  typography: {
    fontFamily: ['"Segoe UI"', '"Inter"', "Roboto", "sans-serif"].join(","),
    h1: { color: "#569CD6", fontWeight: 700 },
    h2: { color: "#569CD6", fontWeight: 700 },
    h3: { color: "#569CD6", fontWeight: 700 },
    h4: { color: "#569CD6", fontWeight: 700 },
    h5: { color: "#569CD6", fontWeight: 700 },
    h6: { color: "#9cdcfe", fontSize: "1rem", fontWeight: 600 },
    subtitle2: { color: "#9cdcfe", fontSize: "0.85rem", opacity: 0.95 },
    body2: { color: "#d4d4d4", fontSize: "0.9rem" },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#3c3c3c", // VS Code title bar
          color: "#d4d4d4",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 4,
        },
        contained: {
          boxShadow: "none",
          backgroundColor: "#007ACC",
          "&:hover": {
            backgroundColor: "#0098FF",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          backgroundColor: "#252526",
          color: "#d4d4d4",
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          color: "#d4d4d4",
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        ".rffm-coach-theme body": {
          backgroundColor: "#1e1e1e",
          color: "#d4d4d4",
        },
        ".rffm-coach-theme": {
          "--rffm-gradient-bg":
            "linear-gradient(180deg, #1e1e1e 0%, #252526 100%)",
          "--rffm-card-bg": "#252526",
          "--rffm-title-gradient":
            "linear-gradient(135deg, #007ACC 0%, #4ec9b0 100%)",
          "--bg": "#1e1e1e",
          // Dialog text: light for dark backgrounds
          "--rffm-coach-dialog-text": "#d4d4d4",
        },
        // Ensure dialog typography and buttons use the dialog text variable
        ".rffm-coach-theme [data-coach-dialog] .MuiTypography-root, .rffm-coach-theme [data-coach-dialog] .MuiButton-root, .rffm-coach-theme [data-coach-dialog] .MuiDialogContent-root, .rffm-coach-theme [data-coach-dialog] .MuiDialogActions-root":
          {
            color: "var(--rffm-coach-dialog-text, #d4d4d4)",
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
