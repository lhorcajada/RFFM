import { Box, CircularProgress, Typography } from "@mui/material";
import type { TacticalBoardState } from "../hooks/useTacticalBoard";
import styles from "../NewExercisePage.module.css";

interface ChapasStripProps {
  board: TacticalBoardState;
}

export default function ChapasStrip({ board }: ChapasStripProps) {
  const {
    loadingPlayers,
    chapasError,
    availablePlayersForStrip,
    handleChapaDragStart,
    handleChapaDragEnd,
  } = board;

  if (loadingPlayers) {
    return (
      <Box className={styles.chapasStrip}>
        <Box className={styles.chapasLoading}>
          <CircularProgress size={18} />
        </Box>
      </Box>
    );
  }

  if (chapasError) {
    return (
      <Box className={styles.chapasStrip}>
        <Typography className={styles.chapasHint}>{chapasError}</Typography>
      </Box>
    );
  }

  if (availablePlayersForStrip.length === 0) {
    return (
      <Box className={styles.chapasStrip}>
        <Typography className={styles.chapasHint}>No hay jugadores para este equipo.</Typography>
      </Box>
    );
  }

  return (
    <Box className={styles.chapasStrip}>
      {availablePlayersForStrip.map((player, idx) => {
        const dorsal = player.dorsal ?? idx + 1;
        const alias = (player.alias ?? "").trim() || `J${idx + 1}`;
        return (
          <Box
            key={player.id ?? `${alias}-${idx}`}
            className={styles.chapa}
            draggable={!!player.id}
            onDragStart={(e) => {
              if (!player.id) return;
              handleChapaDragStart(e, player.id);
            }}
            onDragEnd={(e) => {
              if (!player.id) return;
              handleChapaDragEnd(e, player.id);
            }}
            title="Arrastra al campo"
          >
            <span className={styles.chapaDorsal}>{dorsal}</span>
            <span className={styles.chapaAlias}>{alias}</span>
          </Box>
        );
      })}
    </Box>
  );
}
