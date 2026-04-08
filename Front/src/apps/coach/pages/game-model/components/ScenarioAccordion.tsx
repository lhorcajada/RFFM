import { useState } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Typography,
  Chip,
  Button,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import EventNoteIcon from "@mui/icons-material/EventNote";
import { useNavigate, useLocation } from "react-router-dom";
import type { Scenario, SubPrinciple } from "../../../types/gameModel";
import SubSubPrincipleCard from "./SubSubPrincipleCard";
import styles from "./ScenarioAccordion.module.css";

interface Props {
  scenario: Scenario;
  defaultExpanded?: boolean;
  clubId: string;
  teamId: string;
  gameMomentName: string;
  zoneName: string;
}

interface SpProps {
  sp: SubPrinciple;
  clubId: string;
  teamId: string;
  scenario: { id: number; name: string; order: number };
  gameMomentName: string;
  zoneName: string;
}

function SubPrincipleAccordion({ sp, clubId, teamId, scenario, gameMomentName, zoneName }: SpProps) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleNewSession = () => {
    navigate(`/coach/game-model/create-session${location.search}`, {
      state: {
        gameMomentName,
        zoneName,
        scenario: { id: scenario.id, name: scenario.name, order: scenario.order },
        subPrinciple: {
          id: sp.id,
          apiId: sp.apiId ?? null,
          label: sp.label,
          name: sp.name,
          context: sp.context,
          tacticalPrinciples: sp.tacticalPrinciples,
          subSubPrincipleApiIds: sp.subSubPrinciples
            .map((ssp) => ssp.apiId)
            .filter((id): id is string => id != null),
        },
        clubId,
        teamId,
      },
    });
  };

  const handleViewSessions = () => {
    navigate(`/coach/game-model/sessions${location.search}`, {
      state: {
        gameMomentName,
        zoneName,
        scenario: { id: scenario.id, name: scenario.name, order: scenario.order },
        subPrinciple: {
          id: sp.id,
          apiId: sp.apiId ?? null,
          label: sp.label,
          name: sp.name,
          tacticalPrinciples: sp.tacticalPrinciples,
        },
        teamId,
        clubId,
      },
    });
  };

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
          <Button
            size="small"
            variant="outlined"
            startIcon={<FitnessCenterIcon />}
            className={styles.newSessionBtn}
            onClick={(e) => { e.stopPropagation(); handleNewSession(); }}
          >
            Nueva sesión
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<EventNoteIcon />}
            className={styles.viewSessionsBtn}
            onClick={(e) => { e.stopPropagation(); handleViewSessions(); }}
          >
            Ver sesiones
          </Button>
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
                clubId={clubId}
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
  clubId,
  teamId,
  gameMomentName,
  zoneName,
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

        {/* Sub-principles */}
        {scenario.subPrinciples.length > 0 && (
          <Box className={styles.subPrinciples}>
            {scenario.subPrinciples.map((sp) => (
              <SubPrincipleAccordion
                key={sp.id}
                sp={sp}
                clubId={clubId}
                teamId={teamId}
                scenario={{ id: scenario.id, name: scenario.name, order: scenario.order }}
                gameMomentName={gameMomentName}
                zoneName={zoneName}
              />
            ))}
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
