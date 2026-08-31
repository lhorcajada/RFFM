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
    h1: {
      color: "var(--rffm-hero-title, #ffffff)",
      fontWeight: 800,
      fontSize: "var(--rffm-hero-title-size)",
      lineHeight: "var(--rffm-hero-title-line-height)",
    },
    h2: { color: "#7ab8f5", fontWeight: 700 },
    h3: { color: "#7ab8f5", fontWeight: 700 },
    h4: { color: "#7ab8f5", fontWeight: 700 },
    h5: { color: "#7ab8f5", fontWeight: 700 },
    h6: { color: "#a8d4f5", fontSize: "1rem", fontWeight: 600 },
    subtitle2: {
      color: "var(--rffm-hero-eyebrow-text)",
      fontSize: "var(--rffm-hero-eyebrow-size)",
      lineHeight: "var(--rffm-hero-eyebrow-line-height)",
      opacity: 1,
    },
    body2: {
      color: "var(--rffm-hero-text, #eef4ff)",
      fontSize: "var(--rffm-hero-text-size)",
      lineHeight: "var(--rffm-hero-text-line-height)",
    },
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
          "--rffm-font-family-base": '"Segoe UI", "Inter", Roboto, sans-serif',
          "--rffm-gradient-bg":
            "linear-gradient(180deg, #07071a 0%, #0e0e26 100%)",
          "--rffm-card-bg": "#1c1c30",
          "--rffm-card-text": "#e8e8e8",
          "--rffm-card-subtext": "rgba(255,255,255,0.68)",
          "--rffm-title-gradient":
            "linear-gradient(135deg, #4d9de0 0%, #4ec9b0 100%)",
          "--bg": "#07071a",
          "--rffm-hero-title": "#ffffff",
          "--rffm-hero-title-size": "clamp(1.5rem, 2.3vw, 2.2rem)",
          "--rffm-hero-title-line-height": "1.05",
          "--rffm-hero-text": "#f2f7ff",
          "--rffm-hero-text-size": "0.9rem",
          "--rffm-hero-text-line-height": "1.6",
          "--rffm-hero-border": "rgba(77, 157, 224, 0.22)",
          "--rffm-hero-surface": "linear-gradient(135deg, #1c1c30 0%, #15182c 100%)",
          "--rffm-hero-glow": "radial-gradient(circle at top right, rgba(77, 157, 224, 0.26), transparent 34%)",
          "--rffm-hero-shadow": "0 18px 40px rgba(0, 0, 0, 0.18)",
          "--rffm-hero-eyebrow-bg": "rgba(77, 157, 224, 0.14)",
          "--rffm-hero-eyebrow-text": "#4d9de0",
          "--rffm-hero-eyebrow-size": "0.75rem",
          "--rffm-hero-eyebrow-line-height": "1",
          "--rffm-hero-icon-size": "0.875rem",
          "--rffm-season-access-page-padding-bottom": "1.5rem",
          "--rffm-season-access-hero-margin-top": "0.5rem",
          "--rffm-season-access-hero-padding": "1.25rem",
          "--rffm-season-access-hero-radius": "1.125rem",
          "--rffm-season-access-hero-gap": "0.75rem",
          "--rffm-season-access-eyebrow-gap": "0.5rem",
          "--rffm-season-access-eyebrow-padding-y": "0.25rem",
          "--rffm-season-access-eyebrow-padding-x": "0.625rem",
          "--rffm-season-access-eyebrow-radius": "999px",
          "--rffm-season-access-card-margin-top": "0.5rem",
          "--rffm-season-access-card-padding": "1rem",
          "--rffm-season-access-card-radius": "0.875rem",
          "--rffm-season-access-card-gap": "0.625rem",
          "--rffm-season-access-actions-gap": "0.5rem",
          "--rffm-season-access-actionbar-gap": "0.5rem",
          "--rffm-season-access-chip-group-gap": "0.5rem",
          "--rffm-hero-card-border": "rgba(77, 157, 224, 0.1)",
          "--rffm-primary": "#4d9de0",
          "--rffm-secondary": "#4ec9b0",
          "--rffm-coach-dialog-text": "#e8e8e8",
          "--rffm-text-primary": "#e8e8e8",
          /* FC26 dashboard card vars */
          "--rffm-dash-card-bg": "#111128",
          "--rffm-dash-accent": "#4d9de0",
          "--rffm-dash-card-text": "#e8e8e8",
          "--rffm-dash-desc-text": "rgba(232, 232, 232, 0.5)",
          /* ClubTeams page tokens */
          "--rffm-club-teams-page-padding": "1.25rem",
          "--rffm-club-teams-list-gap": "0.75rem",
          "--rffm-club-teams-list-row-gap": "1.25rem",
          "--rffm-club-teams-list-column-gap": "1.25rem",
          "--rffm-club-teams-card-margin": "0.5rem",
          "--rffm-club-teams-card-outer-margin": "0.25rem",
          "--rffm-club-teams-grid-columns": "2",
          "--rffm-club-teams-grid-columns-tablet": "2",
          "--rffm-club-teams-grid-columns-mobile": "1",
          "--rffm-club-teams-card-padding": "0.75rem",
          "--rffm-club-teams-card-inner-gap": "0.5rem",
          "--rffm-club-teams-card-min-height": "7rem",
          "--rffm-club-teams-card-accent-size": "0.1875rem",
          "--rffm-club-teams-card-radius": "0.5rem",
          "--rffm-club-teams-corner-size": "1rem",
          "--rffm-club-teams-corner-opacity": "0.35",
          "--rffm-club-teams-card-hover-brightness": "1.12",
          "--rffm-club-teams-header-gap": "0.75rem",
          "--rffm-club-teams-header-gap-mobile": "0.5rem",
          "--rffm-club-teams-photo-size": "4rem",
          "--rffm-club-teams-photo-size-mobile": "3rem",
          "--rffm-club-teams-photo-radius": "0.5rem",
          "--rffm-club-teams-photo-bg": "var(--rffm-hero-surface)",
          "--rffm-club-teams-icon-wrap-size": "3rem",
          "--rffm-club-teams-icon-wrap-size-mobile": "2.5rem",
          "--rffm-club-teams-icon-wrap-gap": "0.5rem",
          "--rffm-club-teams-icon-size": "3rem",
          "--rffm-club-teams-icon-radius": "0.5rem",
          "--rffm-club-teams-fallback-icon-size": "1.625rem",
          "--rffm-club-teams-info-gap": "0.375rem",
          "--rffm-club-teams-title-size": "1rem",
          "--rffm-club-teams-title-letter-spacing": "0.06em",
          "--rffm-club-teams-meta-size": "0.9rem",
          "--rffm-club-teams-card-min-width": "15rem",
          "--rffm-club-teams-code-row-gap": "0.25rem",
          "--rffm-club-teams-code-row-padding-y-top": "0.25rem",
          "--rffm-club-teams-code-row-padding-y-bottom": "0.375rem",
          "--rffm-club-teams-code-row-padding-x": "0.5rem",
          "--rffm-club-teams-code-size": "0.75rem",
          "--rffm-club-teams-code-line-height": "1.3",
          "--rffm-club-teams-code-letter-spacing": "0.05em",
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
