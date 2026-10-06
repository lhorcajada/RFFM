import React from "react";
import {
  Modal,
  Box,
  CircularProgress,
  Typography,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import styles from "./ParticipationModal.module.css";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";

import type { TeamParticipationSummaryItem } from "../../../types/participation";

type Props = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  data: TeamParticipationSummaryItem[];
};

function groupBySeason(data: TeamParticipationSummaryItem[]) {
  const groups: { seasonName: string; items: TeamParticipationSummaryItem[] }[] = [];
  data.forEach((item) => {
    const seasonName = item.seasonName ?? "";
    const group = groups.find((g) => g.seasonName === seasonName);
    if (group) group.items.push(item);
    else groups.push({ seasonName, items: [item] });
  });
  return groups;
}

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
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: "rgba(2, 6, 23, 0.45)",
          },
        },
      }}
    >
      <Box className={styles.modalContent}>
        <IconButton
          aria-label="Cerrar"
          onClick={onClose}
          size="small"
          className={styles.closeButton}
        >
          <CloseIcon />
        </IconButton>
        {loading ? (
          <div className={styles.loadingContainer}>
            <CircularProgress size={28} color="inherit" />
          </div>
        ) : data.length === 0 ? (
          <div className={styles.emptyState}>
            <EmptyState
              description={
                "No hay participaciones registradas para este equipo"
              }
            />
          </div>
        ) : (
          <div className={styles.participationList}>
            {groupBySeason(data).map(({ seasonName, items }) => {
              const content = items.map((p, idx) => (
                <div key={idx} className={styles.participationItem}>
                  <div className={styles.participationTitle}>
                    {p.competitionName} — {p.groupName}
                  </div>
                  <div className={styles.participationDetails}>
                    {p.teamName} ({p.teamCode}) — Puntos: {p.teamPoints} —
                    Jugadores: {p.count}
                  </div>
                  <ul className={styles.playersList}>
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
              ));

              if (!seasonName)
                return <React.Fragment key="sin-temporada">{content}</React.Fragment>;

              const label = `Temporada ${seasonName}`;
              return (
                <section
                  key={seasonName}
                  aria-label={label}
                  className={styles.seasonGroup}
                >
                  <Typography component="h3" className={styles.seasonTitle}>
                    {label}
                  </Typography>
                  {content}
                </section>
              );
            })}
          </div>
        )}
      </Box>
    </Modal>
  );
}
