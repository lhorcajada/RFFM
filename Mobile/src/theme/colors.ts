// Paleta extraída 1:1 de Front/src/apps/coach/muiCoachTheme.ts (tema Coach, web).
// Mantener sincronizado a mano si se retocan los valores del theme Coach.
export const coachColors = {
  background: '#07071a',      // palette.background.default
  surface: '#1c1c30',         // palette.background.paper / --rffm-card-bg
  surfaceAlt: '#252545',      // MuiAppBar backgroundColor
  primary: '#4d9de0',         // palette.primary.main
  primaryLight: '#7ab8f5',    // palette.primary.light
  secondary: '#4ec9b0',       // palette.secondary.main (teal)
  textPrimary: '#e8e8e8',     // palette.text.primary
  textSecondary: 'rgba(255,255,255,0.55)', // palette.text.secondary
  border: 'rgba(255,255,255,0.08)',        // palette.divider
  error: '#ff9b9b',           // AttendanceSummary.module.css
  accentOrange: '#ff9800',    // AttendanceTabs.module.css
  contrastText: '#0d0d1f',    // palette.primary.contrastText
} as const;

export type CoachColorToken = keyof typeof coachColors;
