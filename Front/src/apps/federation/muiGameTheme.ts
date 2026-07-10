import { createTheme } from "@mui/material/styles";

// ─── EA FC 26 unified theme — Premium Cinema Visual ─────────────────────────
// Enhanced with dynamic gradients, glow effects, and cinematographic styling
// inspired by EA Sports FC 2026 UI. Single source of truth for all apps.
//
// Key colours:
//   Electric cyan   #00e5ff  (primary — ultra-bright)
//   Premium gold    #ffc107  (secondary — warm luxury)
//   Deep navy       #030a15  (background — profound depth)
//   Card surface    #0a1628  (elevated contrast)
// ─────────────────────────────────────────────────────────────────────────────

const gameTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#00e5ff",
      light: "#5fffff",
      dark: "#0099cc",
      contrastText: "#030a15",
    },
    secondary: {
      main: "#ffc107",
      light: "#ffe082",
      dark: "#ff9800",
      contrastText: "#030a15",
    },
    background: {
      default: "#030a15",
      paper: "#0a1628",
    },
    text: {
      primary: "#f0f8ff",
      secondary: "rgba(210, 240, 255, 0.72)",
    },
    divider: "rgba(0, 229, 255, 0.15)",
    info: {
      main: "#ffc107",
      contrastText: "#030a15",
    },
    error: { main: "#ff5252" },
    success: { main: "#1de9b6" },
    warning: { main: "#ffc107" },
  },
  typography: {
    fontFamily: ['"Oswald"', '"Segoe UI"', "Roboto", "sans-serif"].join(","),
    h1: {
      fontWeight: 800,
      letterSpacing: "0.03em",
      textTransform: "uppercase",
      fontSize: "3rem",
    },
    h2: {
      fontWeight: 700,
      letterSpacing: "0.025em",
      textTransform: "uppercase",
      fontSize: "2.2rem",
    },
    h3: {
      fontWeight: 700,
      letterSpacing: "0.02em",
      textTransform: "uppercase",
      fontSize: "1.75rem",
    },
    h4: {
      fontWeight: 700,
      letterSpacing: "0.015em",
      textTransform: "uppercase",
      fontSize: "1.4rem",
    },
    h5: {
      fontWeight: 700,
      letterSpacing: "0.01em",
      fontSize: "1.1rem",
    },
    h6: {
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      fontSize: "0.95rem",
    },
    subtitle1: {
      fontSize: "0.95rem",
      fontWeight: 500,
      letterSpacing: "0.01em",
    },
    subtitle2: {
      fontSize: "0.82rem",
      fontWeight: 500,
      opacity: 0.9,
      letterSpacing: "0.005em",
    },
    body1: {
      fontSize: "0.95rem",
      fontWeight: 400,
    },
    body2: {
      fontSize: "0.85rem",
      fontWeight: 400,
    },
    button: {
      fontFamily: '"Oswald", sans-serif',
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage:
            "linear-gradient(135deg, rgba(0,229,255,0.05) 0%, rgba(255,193,7,0.03) 50%, rgba(0,0,0,0.2) 100%)",
          border: "1px solid rgba(0, 229, 255, 0.18)",
          borderRadius: 8,
          backdropFilter: "blur(8px)",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        },
        elevation1: {
          boxShadow:
            "0 2px 8px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(0, 229, 255, 0.1)",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(3, 10, 21, 0.95)",
          backgroundImage:
            "linear-gradient(to bottom, rgba(0, 229, 255, 0.08), rgba(0, 0, 0, 0.3))",
          borderBottom: "2px solid rgba(0, 229, 255, 0.25)",
          boxShadow:
            "0 4px 20px rgba(0, 229, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(10px)",
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          backdropFilter: "blur(8px)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "uppercase",
          fontFamily: '"Oswald", sans-serif',
          fontWeight: 700,
          letterSpacing: "0.12em",
          borderRadius: 6,
          transition:
            "all 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease-out",
          position: "relative",
          overflow: "hidden",
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: "-100%",
            width: "100%",
            height: "100%",
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
            transition: "left 0.5s ease-out",
          },
          "&:hover::before": {
            left: "100%",
          },
        },
        contained: {
          backgroundColor: "#00e5ff",
          color: "#030a15",
          fontWeight: 800,
          boxShadow:
            "0 0 20px rgba(0, 229, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
          border: "2px solid rgba(0, 229, 255, 0.4)",
          "&:hover": {
            backgroundColor: "#5fffff",
            boxShadow:
              "0 0 40px rgba(0, 229, 255, 0.6), 0 0 60px rgba(0, 229, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
            transform: "translateY(-2px)",
          },
          "&:active": {
            boxShadow:
              "0 0 20px rgba(0, 229, 255, 0.4), inset 0 2px 4px rgba(0, 0, 0, 0.3)",
            transform: "translateY(0)",
          },
          "&:disabled": {
            backgroundColor: "rgba(0, 229, 255, 0.3)",
            color: "rgba(3, 10, 21, 0.5)",
            boxShadow: "none",
          },
        },
        containedSecondary: {
          backgroundColor: "#ffc107",
          color: "#030a15",
          fontWeight: 800,
          boxShadow:
            "0 0 20px rgba(255, 193, 7, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
          border: "2px solid rgba(255, 193, 7, 0.4)",
          "&:hover": {
            backgroundColor: "#ffe082",
            boxShadow:
              "0 0 40px rgba(255, 193, 7, 0.6), 0 0 60px rgba(255, 193, 7, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
            transform: "translateY(-2px)",
          },
        },
        outlined: {
          borderColor: "rgba(0, 229, 255, 0.5)",
          color: "#00e5ff",
          fontWeight: 700,
          border: "2px solid rgba(0, 229, 255, 0.5)",
          backgroundColor: "rgba(0, 229, 255, 0.05)",
          "&:hover": {
            borderColor: "#00e5ff",
            backgroundColor: "rgba(0, 229, 255, 0.12)",
            boxShadow:
              "0 0 20px rgba(0, 229, 255, 0.4), inset 0 0 20px rgba(0, 229, 255, 0.08)",
            transform: "translateY(-2px)",
          },
        },
        text: {
          color: "#00e5ff",
          fontWeight: 700,
          "&:hover": {
            backgroundColor: "rgba(0, 229, 255, 0.1)",
            boxShadow: "0 0 20px rgba(0, 229, 255, 0.2)",
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: "#0a1628",
          backgroundImage:
            "linear-gradient(135deg, rgba(0,229,255,0.06) 0%, rgba(255,193,7,0.02) 50%, rgba(0,0,0,0.25) 100%)",
          border: "1.5px solid rgba(0, 229, 255, 0.22)",
          borderRadius: 12,
          boxShadow:
            "0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(0, 229, 255, 0.1), 0 0 40px rgba(0, 229, 255, 0.08)",
          backdropFilter: "blur(12px)",
          transition:
            "all 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s ease-out",
          "&:hover": {
            borderColor: "rgba(0, 229, 255, 0.35)",
            boxShadow:
              "0 12px 48px rgba(0, 229, 255, 0.15), inset 0 1px 0 rgba(0, 229, 255, 0.15), 0 0 60px rgba(0, 229, 255, 0.12)",
            transform: "translateY(-4px) scale(1.01)",
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: "56px",
          borderRadius: 8,
          backgroundColor: "rgba(3, 10, 21, 0.4)",
          backdropFilter: "blur(8px)",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(0, 229, 255, 0.3)",
            borderWidth: "2px",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(0, 229, 255, 0.5)",
            boxShadow: "inset 0 0 12px rgba(0, 229, 255, 0.08)",
          },
          "&.Mui-focused": {
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: "#00e5ff",
              borderWidth: "2px",
              boxShadow: "inset 0 0 16px rgba(0, 229, 255, 0.15)",
            },
            boxShadow:
              "0 0 24px rgba(0, 229, 255, 0.25), inset 0 0 16px rgba(0, 229, 255, 0.1)",
          },
        },
        input: {
          padding: "16px 14px",
          fontSize: "0.95rem",
          fontWeight: 500,
          color: "#f0f8ff",
          "&::placeholder": {
            color: "rgba(210, 240, 255, 0.4)",
            opacity: 1,
          },
          "&:-webkit-autofill": {
            WebkitBoxShadow: "0 0 0 1000px #0a1628 inset !important",
            WebkitTextFillColor: "#f0f8ff !important",
            caretColor: "#00e5ff",
            transition: "background-color 5000s ease-in-out 0s",
          },
          "&:-webkit-autofill:focus": {
            WebkitBoxShadow:
              "0 0 0 1000px #0a1628 inset !important, inset 0 0 16px rgba(0, 229, 255, 0.15) !important",
            WebkitTextFillColor: "#f0f8ff !important",
            caretColor: "#00e5ff",
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: {
          color: "#00e5ff",
          transition: "color 0.3s ease-out",
        },
        select: {
          color: "#f0f8ff",
          fontWeight: 500,
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: "rgba(210, 240, 255, 0.7)",
          fontWeight: 600,
          letterSpacing: "0.005em",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          "&.Mui-focused": {
            color: "#00e5ff",
            textShadow: "0 0 12px rgba(0, 229, 255, 0.4)",
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: "rgba(0, 229, 255, 0.18)",
          borderWidth: "1px",
          background:
            "linear-gradient(90deg, transparent, rgba(0, 229, 255, 0.3), transparent)",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(0, 229, 255, 0.12)",
          border: "1px solid rgba(0, 229, 255, 0.3)",
          color: "#00e5ff",
          fontWeight: 600,
          borderRadius: 6,
          transition: "all 0.3s ease-out",
          "&:hover": {
            backgroundColor: "rgba(0, 229, 255, 0.22)",
            boxShadow: "0 0 16px rgba(0, 229, 255, 0.3)",
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage:
            "linear-gradient(135deg, rgba(0,229,255,0.08) 0%, rgba(255,193,7,0.03) 50%, rgba(0,0,0,0.3) 100%)",
          border: "2px solid rgba(0, 229, 255, 0.25)",
          boxShadow:
            "0 20px 80px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(0, 229, 255, 0.1), 0 0 60px rgba(0, 229, 255, 0.15)",
          backdropFilter: "blur(16px)",
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(4px)",
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        ":root": {
          // ─── Enhanced FC26 CSS custom properties ───
          "--rffm-gradient-bg":
            "linear-gradient(135deg, #030a15 0%, #0a1628 50%, #030a15 100%)",
          "--rffm-card-bg": "#0a1628",
          "--rffm-title-gradient":
            "linear-gradient(135deg, #00e5ff 0%, #5fffff 50%, #ffc107 100%)",
          "--rffm-primary": "#00e5ff",
          "--rffm-secondary": "#ffc107",
          "--bg": "#030a15",
          "--rffm-footer-border":
            "2px solid rgba(0, 229, 255, 0.22), 0 0 20px rgba(0, 229, 255, 0.08)",
          // ─── Enhanced dashboard card variables ───
          "--rffm-dash-card-bg": "#0a1628",
          "--rffm-dash-accent": "#00e5ff",
          "--rffm-dash-card-text": "#f0f8ff",
          "--rffm-dash-desc-text": "rgba(210, 240, 255, 0.65)",
          "--rffm-dash-card-border": "rgba(0, 229, 255, 0.22)",
          "--rffm-dash-card-shadow":
            "0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(0, 229, 255, 0.1), 0 0 40px rgba(0, 229, 255, 0.08)",
          // ─── Coach compatibility variables ───
          "--rffm-coach-dialog-text": "#f0f8ff",
          // ─── Animation & transition variables ───
          "--rffm-transition-fast": "0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          "--rffm-transition-smooth": "0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          "--rffm-transition-slow": "0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          // ─── Glow effects ───
          "--rffm-glow-cyan": "0 0 20px rgba(0, 229, 255, 0.4)",
          "--rffm-glow-gold": "0 0 20px rgba(255, 193, 7, 0.4)",
        },
        body: {
          backgroundImage:
            "linear-gradient(135deg, #030a15 0%, #0a1628 50%, #030a15 100%)",
          backgroundAttachment: "fixed",
        },
        "*": {
          transition:
            "background-color 0.3s ease-out, border-color 0.3s ease-out, box-shadow 0.3s ease-out",
        },
      },
    },
  },
});

export default gameTheme;
