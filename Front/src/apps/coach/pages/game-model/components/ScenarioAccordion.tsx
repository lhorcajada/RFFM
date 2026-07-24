import { useEffect, useState } from "react";
import { Box, Typography, Chip, Button } from "@mui/material";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import EventNoteIcon from "@mui/icons-material/EventNote";
import { useNavigate, useLocation } from "react-router-dom";
import type { Scenario, SubPrinciple } from "../../../types/gameModel";
import DrillDownPanel from "./DrillDownPanel";
import SubSubPrincipleCard from "./SubSubPrincipleCard";
import styles from "./ScenarioAccordion.module.css";

interface Props {
  scenarios: Scenario[];
  clubId: string;
  teamId: string;
  gameMomentName: string;
  zoneName: string;
}

interface SpDetailProps {
  sp: SubPrinciple;
  clubId: string;
  teamId: string;
  scenario: { id: number; name: string; order: number };
  gameMomentName: string;
  zoneName: string;
}

function SubPrincipleDetailView({ sp, clubId, teamId, scenario, gameMomentName, zoneName }: SpDetailProps) {
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
          subSubPrincipleApiIds: sp.subSubPrinciples.map((ssp) => ssp.apiId).filter((id): id is string => id != null),
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
    <Box className={styles.spDetailView}>
      <Box className={styles.spDetailHeader}>
        <Typography className={styles.subPrincipleName}>{sp.name.toUpperCase()}</Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<FitnessCenterIcon />}
          className={styles.newSessionBtn}
          onClick={handleNewSession}
        >
          Nueva sesión
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<EventNoteIcon />}
          className={styles.viewSessionsBtn}
          onClick={handleViewSessions}
        >
          Ver sesiones
        </Button>
      </Box>

      <Typography className={styles.subPrincipleContext}>{sp.context}</Typography>

      {sp.tacticalPrinciples.length > 0 && (
        <Box className={styles.principlesRow}>
          <Typography className={styles.principlesLabel}>Principios tácticos colectivos:</Typography>
          <Box className={styles.chipRow}>
            {sp.tacticalPrinciples.map((p) => (
              <Chip key={p.id} label={p.name} size="small" className={styles.principleChip} />
            ))}
          </Box>
        </Box>
      )}

      {sp.subSubPrinciples.length > 0 && (
        <Box className={styles.subSubPrinciples}>
          {sp.subSubPrinciples.map((ssp, idx) => (
            <SubSubPrincipleCard key={ssp.id} index={idx + 1} subSubPrinciple={ssp} clubId={clubId} />
          ))}
        </Box>
      )}
    </Box>
  );
}

interface ScenarioDetailProps {
  scenario: Scenario;
  clubId: string;
  teamId: string;
  gameMomentName: string;
  zoneName: string;
}

function ScenarioDetailView({ scenario, clubId, teamId, gameMomentName, zoneName }: ScenarioDetailProps) {
  const [selectedPi, setSelectedPi] = useState<number | null>(scenario.subPrinciples.length === 1 ? 0 : null);

  useEffect(() => {
    if (selectedPi !== null && selectedPi >= scenario.subPrinciples.length) setSelectedPi(null);
  }, [scenario.subPrinciples.length, selectedPi]);

  return (
    <Box className={styles.scenarioDetailView}>
      <Typography className={styles.context}>{scenario.context}</Typography>

      {scenario.mediaUrl && (
        <Box className={styles.mediaViewer}>
          {scenario.mediaType === "video" ? (
            <video src={scenario.mediaUrl} controls className={styles.mediaViewerContent} />
          ) : (
            <img
              src={scenario.mediaUrl}
              alt={`Situación: ${scenario.name}`}
              className={styles.mediaViewerContent}
            />
          )}
        </Box>
      )}

      {scenario.tacticalPrinciples.length > 0 && (
        <Box className={styles.principlesRow}>
          <Typography className={styles.principlesLabel}>Principios tácticos colectivos:</Typography>
          <Box className={styles.chipRow}>
            {scenario.tacticalPrinciples.map((p) => (
              <Chip key={p.id} label={p.name} size="small" className={styles.principleChip} />
            ))}
          </Box>
        </Box>
      )}

      {scenario.subPrinciples.length > 0 ? (
        <DrillDownPanel<SubPrinciple>
          items={scenario.subPrinciples}
          getKey={(sp) => sp.id}
          selectedIndex={selectedPi}
          onSelect={setSelectedPi}
          onBack={() => setSelectedPi(null)}
          listAriaLabel="Lista de subprincipios"
          emptyMessage="Selecciona un subprincipio para ver su detalle."
          detailTitle={(sp) => `Subprincipio ${sp.label}`}
          forceSinglePane
          renderListItem={(sp) => (
            <Box className={styles.listItemContent}>
              <Typography className={styles.subPrincipleLabel}>Subprincipio {sp.label}</Typography>
              <Typography className={styles.listItemName}>{sp.name.toUpperCase()}</Typography>
              {sp.subSubPrinciples.length > 0 && (
                <Chip
                  label={`${sp.subSubPrinciples.length} sub-subprincipio${sp.subSubPrinciples.length !== 1 ? "s" : ""}`}
                  size="small"
                  className={styles.countChip}
                />
              )}
            </Box>
          )}
          renderDetail={(sp) => (
            <SubPrincipleDetailView
              sp={sp}
              clubId={clubId}
              teamId={teamId}
              scenario={{ id: scenario.id, name: scenario.name, order: scenario.order }}
              gameMomentName={gameMomentName}
              zoneName={zoneName}
            />
          )}
        />
      ) : (
        <Typography className={styles.emptyZoneText}>No hay subprincipios definidos.</Typography>
      )}
    </Box>
  );
}

export default function ScenarioAccordion({ scenarios, clubId, teamId, gameMomentName, zoneName }: Props) {
  const [selectedSi, setSelectedSi] = useState<number | null>(scenarios.length === 1 ? 0 : null);

  useEffect(() => {
    if (selectedSi !== null && selectedSi >= scenarios.length) setSelectedSi(null);
  }, [scenarios.length, selectedSi]);

  return (
    <DrillDownPanel<Scenario>
      items={scenarios}
      getKey={(s) => s.id}
      selectedIndex={selectedSi}
      onSelect={setSelectedSi}
      onBack={() => setSelectedSi(null)}
      listAriaLabel="Lista de escenarios"
      emptyMessage="Selecciona un escenario para ver su detalle."
      detailTitle={(s) => `Escenario ${s.order}`}
      renderListItem={(scenario) => (
        <Box className={styles.listItemContent}>
          <Typography className={styles.scenarioNumber}>Escenario {scenario.order}</Typography>
          <Typography className={styles.listItemName}>{scenario.name}</Typography>
          {scenario.subPrinciples.length > 0 && (
            <Chip
              label={`${scenario.subPrinciples.length} subprincipio${scenario.subPrinciples.length !== 1 ? "s" : ""}`}
              size="small"
              className={styles.countChip}
            />
          )}
        </Box>
      )}
      renderDetail={(scenario) => (
        <ScenarioDetailView
          scenario={scenario}
          clubId={clubId}
          teamId={teamId}
          gameMomentName={gameMomentName}
          zoneName={zoneName}
        />
      )}
    />
  );
}
