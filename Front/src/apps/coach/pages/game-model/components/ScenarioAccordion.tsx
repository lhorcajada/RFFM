import { useState } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Typography,
  Chip,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { Scenario, SubPrinciple } from "../../../types/gameModel";
import SubSubPrincipleCard from "./SubSubPrincipleCard";
import styles from "./ScenarioAccordion.module.css";

interface Props {
  scenario: Scenario;
  defaultExpanded?: boolean;
}

function SubPrincipleAccordion({ sp }: { sp: SubPrinciple }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, isExpanded) => setExpanded(isExpanded)}
      className={styles.spAccordion}
      disableGutters
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon className={styles.spExpandIcon} />}
        className={styles.spSummary}
      >
        <Box className={styles.spSummaryContent}>
          <Typography className={styles.subPrincipleLabel}>
            Subprincipio {sp.label}
          </Typography>
          <Typography className={styles.subPrincipleName}>
            {sp.name.toUpperCase()}
          </Typography>
          {sp.subSubPrinciples.length > 0 && (
            <Chip
              label={`${sp.subSubPrinciples.length} sub-subprincipio${sp.subSubPrinciples.length !== 1 ? "s" : ""}`}
              size="small"
              className={styles.countChip}
            />
          )}
        </Box>
      </AccordionSummary>

      <AccordionDetails className={styles.spDetails}>
        <Typography className={styles.subPrincipleContext}>
          {sp.context}
        </Typography>

        {sp.tacticalPrinciples.length > 0 && (
          <Box className={styles.principlesRow}>
            <Typography className={styles.principlesLabel}>
              Principios tácticos colectivos:
            </Typography>
            <Box className={styles.chipRow}>
              {sp.tacticalPrinciples.map((p) => (
                <Chip
                  key={p.id}
                  label={p.name}
                  size="small"
                  className={styles.principleChip}
                />
              ))}
            </Box>
          </Box>
        )}

        {sp.subSubPrinciples.length > 0 && (
          <Box className={styles.subSubPrinciples}>
            {sp.subSubPrinciples.map((ssp, idx) => (
              <SubSubPrincipleCard
                key={ssp.id}
                index={idx + 1}
                subSubPrinciple={ssp}
              />
            ))}
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

export default function ScenarioAccordion({
  scenario,
  defaultExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, isExpanded) => setExpanded(isExpanded)}
      className={styles.accordion}
      disableGutters
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon className={styles.expandIcon} />}
        className={styles.summary}
      >
        <Box className={styles.summaryContent}>
          <Typography className={styles.scenarioNumber}>
            Escenario {scenario.order}
          </Typography>
          <Typography className={styles.scenarioName}>{scenario.name}</Typography>
          {scenario.subPrinciples.length > 0 && (
            <Chip
              label={`${scenario.subPrinciples.length} subprincipio${scenario.subPrinciples.length !== 1 ? "s" : ""}`}
              size="small"
              className={styles.countChip}
            />
          )}
        </Box>
      </AccordionSummary>

      <AccordionDetails className={styles.details}>
        {/* Scenario context */}
        <Typography className={styles.context}>{scenario.context}</Typography>

        {/* Scenario tactical principles */}
        {scenario.tacticalPrinciples.length > 0 && (
          <Box className={styles.principlesRow}>
            <Typography className={styles.principlesLabel}>
              Principios tácticos colectivos:
            </Typography>
            <Box className={styles.chipRow}>
              {scenario.tacticalPrinciples.map((p) => (
                <Chip
                  key={p.id}
                  label={p.name}
                  size="small"
                  className={styles.principleChip}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Sub-principles */}
        {scenario.subPrinciples.length > 0 && (
          <Box className={styles.subPrinciples}>
            {scenario.subPrinciples.map((sp) => (
              <SubPrincipleAccordion key={sp.id} sp={sp} />
            ))}
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
