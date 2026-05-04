import { Box, Typography } from "@mui/material";
import { SPACE_TEMPLATES } from "../constants";
import type { TacticalBoardState } from "../hooks/useTacticalBoard";
import styles from "../NewExercisePage.module.css";
import type { SpaceKind } from "../types";

interface SpacesStripProps {
  board: TacticalBoardState;
}

const spaceIconClassMap: Record<SpaceKind, keyof typeof styles> = {
  square: "spaceIconSquare",
  rectangle: "spaceIconRectangle",
  triangle: "spaceIconTriangle",
  pentagon: "spaceIconPentagon",
  hexagon: "spaceIconHexagon",
  heptagon: "spaceIconHeptagon",
  octagon: "spaceIconOctagon",
  circle: "spaceIconCircle",
};

export default function SpacesStrip({ board }: SpacesStripProps) {
  const { handleSpaceTemplateDragStart, handleSpaceDragEnd } = board;

  return (
    <Box className={styles.spacesStrip}>
      {SPACE_TEMPLATES.map((template) => (
        <Box
          key={template.kind}
          className={styles.spaceTemplateCard}
          draggable
          onDragStart={(e) => handleSpaceTemplateDragStart(e, template.kind)}
          onDragEnd={handleSpaceDragEnd}
          title="Arrastra al campo"
        >
          <Box
            className={`${styles.spaceTemplateIcon} ${styles[spaceIconClassMap[template.kind]]}`}
          />
          <Typography className={styles.spaceTemplateTitle}>{template.label}</Typography>
          <Typography className={styles.spaceTemplateHint}>
            {template.kind === "rectangle" ? "1x2 m" : "1 m/lado"}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
