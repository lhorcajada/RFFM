import { Box } from "@mui/material";
import styles from "../NewExercisePage.module.css";

/**
 * Static F11 + F7 pitch markings for one half. Shared between the
 * interactive half (rendered inside TacticalField) and the purely visual
 * mirrored half (the other side of the full pitch).
 */
export default function PitchMarkings() {
  return (
    <>
      <Box className={styles.terrainBandTop} />
      <Box className={styles.terrainBandBottom} />
      <Box className={styles.terrainGoalBack} />
      <Box className={styles.touchLineTop} />
      <Box className={styles.touchLineBottom} />
      <Box className={styles.midLine} />
      <Box className={styles.goalLine} />
      <Box className={styles.centerCircle} />
      <Box className={styles.penaltyArea} />
      <Box className={styles.goalArea} />
      <Box className={styles.penaltySpot} />
      <Box className={styles.penaltyArc} />
      <Box className={styles.goalMouth} />
      <Box className={styles.goalFrame} />

      <Box className={styles.f7Pitch}>
        <Box className={styles.f7AreaTop} />
        <Box className={styles.f7AreaBottom} />
        <Box className={styles.f7GoalTop} />
        <Box className={styles.f7GoalBottom} />
        <Box className={styles.f7CenterPoint} />
      </Box>

      {/* Fuera de juego (offside) line: from the F11 penalty area's corner
          straight out to the touchline (the F7 pitch's own lateral). */}
      <Box className={styles.f7OffsideLineTop} />
      <Box className={styles.f7OffsideLineBottom} />
    </>
  );
}
