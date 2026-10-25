import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

export type DashboardLayout = "mobile" | "tablet" | "desktop";

export function useDashboardLayout(): DashboardLayout {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"), { noSsr: true });

  if (isMobile) return "mobile";
  if (isDesktop) return "desktop";
  return "tablet";
}
