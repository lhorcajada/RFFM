import { Box, Typography } from "@mui/material";
import { MATERIAL_OPTIONS } from "../constants";
import type { TacticalBoardState } from "../hooks/useTacticalBoard";
import styles from "../NewExercisePage.module.css";

interface MaterialsStripProps {
  board: TacticalBoardState;
}

export default function MaterialsStrip({ board }: MaterialsStripProps) {
  const { handleMaterialTemplateDragStart, handleMaterialDragEnd } = board;

  return (
    <Box className={styles.materialsStrip}>
      {MATERIAL_OPTIONS.map((material) => (
        <Box
          key={material.key}
          className={styles.materialCard}
          title={material.label}
          aria-label={material.label}
          draggable
          onDragStart={(e) => handleMaterialTemplateDragStart(e, material.key)}
          onDragEnd={handleMaterialDragEnd}
        >
          {material.key === "setas" ? (
            <Box className={styles.materialSetaIcon}>
              <Box className={styles.materialSetaHole} />
            </Box>
          ) : material.key === "vallas" ? (
            <Box className={styles.materialVallaIcon}>
              <Box className={styles.materialVallaLegLeft} />
              <Box className={styles.materialVallaLegRight} />
              <Box className={styles.materialVallaBar} />
            </Box>
          ) : material.key === "balones" ? (
            <Box className={styles.materialBallIcon} />
          ) : material.key === "conos" ? (
            <Box className={styles.materialConeIcon} />
          ) : material.key === "aros" ? (
            <Box className={styles.materialAroIcon} />
          ) : material.key === "miniporterias" ? (
            <Box className={styles.materialMiniGoalIcon}>
              <Box className={styles.materialGoalPostLeft} />
              <Box className={styles.materialGoalPostRight} />
              <Box className={styles.materialGoalCrossbar} />
              <Box className={styles.materialGoalNet} />
            </Box>
          ) : material.key === "picas" ? (
            <Box className={styles.materialPicaIcon}>
              <Box className={styles.materialPicaTip} />
              <Box className={styles.materialPicaStick} />
              <Box className={styles.materialPicaBase} />
            </Box>
          ) : material.key === "porterias-f11" ? (
            <Box className={styles.materialGoalIcon}>
              <Box className={styles.materialGoalPostLeft} />
              <Box className={styles.materialGoalPostRight} />
              <Box className={styles.materialGoalCrossbar} />
              <Box className={styles.materialGoalNet} />
            </Box>
          ) : material.key === "escalera" ? (
            <Box className={styles.materialLadderIcon} />
          ) : (
            <Typography className={styles.materialIcon}>?</Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}
