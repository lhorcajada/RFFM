import { useState } from "react";
import { Box, Typography, Chip, Collapse, IconButton } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import type { SubSubPrinciple } from "../../../types/gameModel";
import styles from "./SubSubPrincipleCard.module.css";

interface Props {
  index: number;
  subSubPrinciple: SubSubPrinciple;
}

export default function SubSubPrincipleCard({ index, subSubPrinciple }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Box className={styles.card}>
      <Box
        className={styles.header}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <Typography className={styles.title}>
          <span className={styles.index}>{index}.</span> {subSubPrinciple.name}
        </Typography>
        <Box className={styles.headerRight}>
          {subSubPrinciple.essentialSkills.length > 0 && (
            <Chip
              label={`${subSubPrinciple.essentialSkills.length} hab.`}
              size="small"
              className={styles.countChip}
            />
          )}
          <IconButton size="small" className={styles.expandBtn}>
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={expanded} unmountOnExit>
        <Box className={styles.body}>
          <Typography className={styles.action}>{subSubPrinciple.action}</Typography>

          {subSubPrinciple.essentialSkills.length > 0 && (
            <Box className={styles.skills}>
              <Typography className={styles.skillsLabel}>
                Habilidades imprescindibles
              </Typography>
              <ul className={styles.skillList}>
                {subSubPrinciple.essentialSkills.map((skill) => (
                  <li key={skill.id} className={styles.skillItem}>
                    <Chip
                      label={skill.name}
                      size="small"
                      className={styles.chip}
                    />
                    <Typography className={styles.skillDesc}>
                      {skill.description}
                    </Typography>
                  </li>
                ))}
              </ul>
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
