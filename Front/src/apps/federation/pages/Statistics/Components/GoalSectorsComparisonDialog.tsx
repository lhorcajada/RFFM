import React from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
  Typography,
} from "@mui/material";

export type SectorGoalItem = {
  minute: string;
  playerName: string;
  isOwnGoal: boolean;
  usedMinute: number;
};

export type SectorMatchDetail = {
  codacta: string;
  title: string;
  dateLabel: string;
  scoreLabel: string;
  goals: SectorGoalItem[];
};

export type SectorPopupState = {
  open: boolean;
  loading: boolean;
  error: string | null;
  title: string;
  subtitle: string;
  matches: SectorMatchDetail[];
};

export default function GoalSectorsComparisonDialog({
  popup,
  onClose,
}: {
  popup: SectorPopupState;
  onClose: () => void;
}) {
  return (
    <Dialog open={popup.open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{popup.title}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {popup.subtitle}
        </Typography>

        {popup.loading && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 2 }}>
            <CircularProgress size={22} />
            <Typography>Cargando partidos...</Typography>
          </Box>
        )}

        {!popup.loading && popup.error && (
          <Typography color="error">
            No se pudieron cargar los partidos: {popup.error}
          </Typography>
        )}

        {!popup.loading && !popup.error && popup.matches.length === 0 && (
          <Typography color="text.secondary">
            No se encontraron partidos con goles en contra en este rango.
          </Typography>
        )}

        {!popup.loading && !popup.error && popup.matches.length > 0 && (
          <List disablePadding>
            {popup.matches.map((match, index) => (
              <React.Fragment key={`${match.codacta}-${index}`}>
                {index > 0 && <Divider component="li" sx={{ my: 1.5 }} />}
                <ListItem disableGutters alignItems="flex-start">
                  <ListItemText
                    primary={match.title}
                    secondary={
                      <Box sx={{ mt: 0.75, display: "grid", gap: 0.75 }}>
                        <Typography variant="body2" color="text.secondary">
                          {match.dateLabel} · {match.scoreLabel} · {match.codacta}
                        </Typography>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                          {match.goals.map((goal, goalIndex) => (
                            <Box
                              key={`${match.codacta}-${goalIndex}-${goal.minute}`}
                              sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.75,
                                px: 1,
                                py: 0.5,
                                borderRadius: 999,
                                border: "1px solid rgba(239, 68, 68, 0.35)",
                                backgroundColor: "rgba(239, 68, 68, 0.08)",
                                color: "error.main",
                                fontSize: 13,
                                fontWeight: 700,
                              }}
                            >
                              <span>{goal.minute}&apos;</span>
                              <span>{goal.playerName}</span>
                              {goal.isOwnGoal && <span>(Autogol)</span>}
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}