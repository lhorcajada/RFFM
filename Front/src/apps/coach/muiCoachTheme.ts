import { createTheme } from "@mui/material/styles";

const coachTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#ff8a4c", // warm orange for accents
      contrastText: "#2b0f00",
    },
    secondary: {
      main: "#ffd19a", // lighter orange for secondary items
      contrastText: "#2b0f00",
    },
    background: {
      default: "#140603", // much darker background
      paper: "#2a0b06", // dark orange surfaces
    },
    text: {
      primary: "#fff7ef",
      secondary: "#ffe8d0",
    },
  },
  typography: {
    fontFamily: ['"Inter"', '"Segoe UI"', "Roboto", "sans-serif"].join(","),
    h1: { color: "#ff8a4c", fontWeight: 700 },
    h2: { color: "#ff8a4c", fontWeight: 700 },
    h3: { color: "#ff8a4c", fontWeight: 700 },
    h4: { color: "#ff8a4c", fontWeight: 700 },
    h5: { color: "#ff8a4c", fontWeight: 700 },
    h6: { color: "#ff8a4c", fontSize: "1rem", fontWeight: 600 },
    subtitle2: { color: "#ffd19a", fontSize: "0.85rem", opacity: 0.95 },
    body2: { color: "#fff7ef", fontSize: "0.9rem" },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#7A2E0E",
          color: "#fff7ef",
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
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: "#7A2E0E",
          color: "#fff7ef",
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          color: "#ff8a4c",
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        ".rffm-coach-theme body": {
          backgroundColor: "#140603",
          color: "#fff7ef",
        },
        ".rffm-coach-theme": {
          "--rffm-gradient-bg":
            "linear-gradient(180deg, #140603 0%, #2a0b06 100%)",
          "--rffm-card-bg": "#2a0b06",
          "--rffm-title-gradient":
            "linear-gradient(135deg, #ff8a4c 0%, #f97316 100%)",
          "--bg": "#140603",
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
