import React from "react";
import { Modal, Box, CircularProgress, Typography } from "@mui/material";

type Participation = {
  competitionName: string;
  groupName: string;
  teamName: string;
  teamCode?: string;
  teamPoints?: number;
  count?: number;
  players?: any[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  data: Participation[];
};

export default function ParticipationModal({
  open,
  onClose,
  loading,
  data,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="participation-summary-title"
      closeAfterTransition
    >
      <Box
        style={{
          padding: 18,
          maxWidth: 720,
          margin: "40px auto",
          outline: "none",
        }}
      >
        {loading ? (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 18 }}
          >
            <CircularProgress size={28} color="inherit" />
          </div>
        ) : data.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            <Typography variant="body1" color="textSecondary">
              No hay participaciones registradas para este equipo
            </Typography>
          </div>
        ) : (
          <div>
            {data.map((p, idx) => (
              <div key={idx} style={{ marginBottom: 8 }}>
                <strong>
                  {p.competitionName} — {p.groupName}
                </strong>
                <div>
                  {p.teamName} ({p.teamCode}) — Puntos: {p.teamPoints} —
                  Jugadores: {p.count}
                </div>
                <ul style={{ margin: "6px 0 0 12px" }}>
                  {(p.players || [])
                    .filter((pl: any) => pl != null)
                    .map((pl: any, plIdx: number) => (
                      <li key={pl?.playerId ?? pl?.id ?? plIdx}>
                        {pl?.name ?? ""}{" "}
                        {pl?.playerId ? `(${pl.playerId})` : ""}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Box>
    </Modal>
  );
}
