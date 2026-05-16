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
    anonymousChapaOptions,
    handleChapaDragStart,
    handleAnonymousChapaDragStart,
    handleChapaDragEnd,
  } = board;

  return (
    <Box className={styles.chapasStrip}>
      <Box className={styles.chapasStripGroup}>
        <Typography className={styles.chapasStripLabel}>Jugadores</Typography>
        <Box className={styles.chapasStripRow}>
          {loadingPlayers ? (
            <Box className={styles.chapasLoading}>
              <CircularProgress size={18} />
            </Box>
          ) : chapasError ? (
            <Typography className={styles.chapasHint}>{chapasError}</Typography>
          ) : availablePlayersForStrip.length === 0 ? (
            <Typography className={styles.chapasHint}>No hay jugadores para este equipo.</Typography>
          ) : (
            availablePlayersForStrip.map((player, idx) => {
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
            })
          )}
        </Box>
      </Box>

      <Box className={styles.chapasStripGroup}>
        <Typography className={styles.chapasStripLabel}>Anónimas</Typography>
        <Box className={styles.chapasStripAnonRow}>
          {anonymousChapaOptions.map((option) => (
            <Box
              key={option.key}
              className={styles.chapa}
              draggable
              onDragStart={(e) => handleAnonymousChapaDragStart(e, option)}
              title={`Chapa anónima ${option.label}`}
              style={{ background: `radial-gradient(circle at 34% 28%, rgba(255, 255, 255, 0.42), transparent 34%), linear-gradient(160deg, ${option.color} 0%, ${option.color} 100%)` }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
