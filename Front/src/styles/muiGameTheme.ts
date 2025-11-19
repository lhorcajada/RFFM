import createTheme from "@mui/material/styles/createTheme";

const gameTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#00e5ff",
      contrastText: "#001f2d",
    },
    secondary: {
      main: "#ff6ec7",
    },
    background: {
      default: "#071122",
      paper: "#081628",
    },
    text: {
      primary: "#e6f7ff",
      secondary: "#a8d0e6",
    },
    info: {
      main: "#ffd166",
      contrastText: "#071122",
    },
  },
  typography: {
    fontFamily: ['"Press Start 2P"', '"Segoe UI"', "Roboto", "sans-serif"].join(
      ","
    ),
    h6: { fontSize: "1rem", letterSpacing: "0.08em" },
    subtitle2: { fontSize: "0.78rem", opacity: 0.9 },
    body2: { fontSize: "0.82rem" },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage:
            "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.08))",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 10,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          // keep background defined in App sx, ensure content inside AppBar is high-contrast
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          color: "#ffd166",
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: "#ffd166",
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          color: "#ffd166",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 8,
          boxShadow: "0 4px 8px rgba(0,0,0,0.25)",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#ffffff",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#ffffff",
            borderWidth: 1,
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: {
          color: "#ffffff",
        },
        select: {
          color: "#ffffff",
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: "#ffffff",
        },
      },
    },
  },
});

export default gameTheme;
