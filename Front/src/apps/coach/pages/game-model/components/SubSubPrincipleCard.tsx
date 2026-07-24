import { useState } from "react";
import {
  Box, Typography, Chip, Collapse, IconButton,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import { useLocation } from "react-router-dom";
import type { SubSubPrinciple } from "../../../types/gameModel";
import PrincipleExercisesSection from "./PrincipleExercisesSection";
import styles from "./SubSubPrincipleCard.module.css";

interface Props {
  index: number;
  subSubPrinciple: SubSubPrinciple;
  clubId: string;
  subPrincipleApiId?: string | null;
  subPrincipleName?: string | null;
}

export default function SubSubPrincipleCard({
  index,
  subSubPrinciple,
  clubId,
  subPrincipleApiId,
  subPrincipleName,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const teamId = params.get("teamId") ?? "";

  const initialExerciseEstimate = subSubPrinciple.essentialSkills.reduce(
    (sum, sk) => sum + (sk.exerciseCount ?? 0), 0
  );
  const [exCount, setExCount] = useState(initialExerciseEstimate);

  const sspApiId = subSubPrinciple.apiId ?? "";

  return (
    <Box className={styles.card}>
      {/* ── Header ─────────────────────────────────────────────── */}
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
          {exCount > 0 && (
            <Chip
              icon={<FitnessCenterIcon style={{ fontSize: 12 }} />}
              label={`${exCount} ej.`}
              size="small"
              className={styles.exerciseChip}
            />
          )}
          <IconButton size="small" className={styles.expandBtn}>
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Box>
      </Box>

      {/* ── Body ───────────────────────────────────────────────── */}
      <Collapse in={expanded} unmountOnExit>
        <Box className={styles.body}>
          <Typography className={styles.action}>{subSubPrinciple.action}</Typography>

          {/* Essential skills */}
          {subSubPrinciple.essentialSkills.length > 0 && (
            <Box className={styles.skills}>
              <Typography className={styles.skillsLabel}>
                Habilidades imprescindibles
              </Typography>
              <ul className={styles.skillList}>
                {subSubPrinciple.essentialSkills.map((skill) => (
                  <li key={skill.id} className={styles.skillItem}>
                    <Box className={styles.skillRow}>
                      <Chip
                        label={skill.name}
                        size="small"
                        className={`${styles.chip} ${skill.masteredAt ? styles.chipMastered : ""}`}
                      />
                      {skill.masteredAt && (
                        <Typography className={styles.masteredLabel}>✓ Dominada</Typography>
                      )}
                    </Box>
                    <Typography className={styles.skillDesc}>
                      {skill.description}
                    </Typography>
                  </li>
                ))}
              </ul>
            </Box>
          )}

          {/* ── Exercises section ─────────────────────────────── */}
          {clubId && sspApiId && (
            <PrincipleExercisesSection
              clubId={clubId}
              teamId={teamId}
              levelKind="subSubPrinciple"
              levelApiId={sspApiId}
              levelName={subSubPrinciple.name}
              active={expanded}
              onCountChange={setExCount}
              parentSubPrincipleApiId={subPrincipleApiId}
              parentSubPrincipleName={subPrincipleName}
            />
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
