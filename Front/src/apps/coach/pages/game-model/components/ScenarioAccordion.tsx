import { useEffect, useState } from "react";
import { Box, Typography, Chip, Button } from "@mui/material";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import EventNoteIcon from "@mui/icons-material/EventNote";
import { useNavigate, useLocation } from "react-router-dom";
import type { Principle, Scenario, SubPrinciple } from "../../../types/gameModel";
import DrillDownPanel from "./DrillDownPanel";
import PrincipleExercisesSection from "./PrincipleExercisesSection";
import SubSubPrincipleCard from "./SubSubPrincipleCard";
import { resolveMediaUrl } from "./resolveMediaUrl";
import styles from "./ScenarioAccordion.module.css";

interface Props {
  principles: Principle[];
  clubId: string;
  teamId: string;
  gameMomentName: string;
  zoneName: string;
}

interface SpDetailProps {
  sp: SubPrinciple;
  clubId: string;
  teamId: string;
  scenario: { id: number; apiId?: string | null; name: string; order: number };
  gameMomentName: string;
  zoneName: string;
}

function SubPrincipleDetailView({ sp, clubId, teamId, scenario, gameMomentName, zoneName }: SpDetailProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [exerciseCount, setExerciseCount] = useState(0);

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
        {exerciseCount > 0 && (
          <Chip
            icon={<FitnessCenterIcon style={{ fontSize: 12 }} />}
            label={`${exerciseCount} ej.`}
            size="small"
            className={styles.exerciseChip}
          />
        )}
      </Box>

      <Typography className={styles.subPrincipleContext}>{sp.context}</Typography>

      {sp.subSubPrinciples.length > 0 && (
        <Box className={styles.subSubPrinciples}>
          {sp.subSubPrinciples.map((ssp, idx) => (
            <SubSubPrincipleCard
              key={ssp.id}
              index={idx + 1}
              subSubPrinciple={ssp}
              clubId={clubId}
              subPrincipleApiId={sp.apiId}
              subPrincipleName={sp.name}
            />
          ))}
        </Box>
      )}

      {clubId && sp.apiId && (
        <PrincipleExercisesSection
          clubId={clubId}
          teamId={teamId}
          levelKind="subPrinciple"
          levelApiId={sp.apiId}
          levelName={sp.name}
          contextLabel={`Subprincipio ${sp.label}`}
          active
          onCountChange={setExerciseCount}
          parentScenarioApiId={scenario.apiId}
          parentScenarioName={scenario.name}
          siblingSubSubPrinciples={sp.subSubPrinciples
            .filter((ssp): ssp is typeof ssp & { apiId: string } => !!ssp.apiId)
            .map((ssp) => ({ apiId: ssp.apiId, name: ssp.name }))}
        />
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
  const [exerciseCount, setExerciseCount] = useState(0);

  useEffect(() => {
    if (selectedPi !== null && selectedPi >= scenario.subPrinciples.length) setSelectedPi(null);
  }, [scenario.subPrinciples.length, selectedPi]);

  return (
    <Box className={styles.scenarioDetailView}>
      <Box className={styles.scenarioDetailHeader}>
        <Typography className={styles.context}>{scenario.context}</Typography>
        {exerciseCount > 0 && (
          <Chip
            icon={<FitnessCenterIcon style={{ fontSize: 12 }} />}
            label={`${exerciseCount} ej.`}
            size="small"
            className={styles.exerciseChip}
          />
        )}
      </Box>

      {scenario.mediaUrl && (
        <Box className={styles.mediaViewer}>
          {scenario.mediaType === "video" ? (
            <video src={resolveMediaUrl(scenario.mediaUrl)} controls className={styles.mediaViewerContent} />
          ) : (
            <img
              src={resolveMediaUrl(scenario.mediaUrl)}
              alt={`Situación: ${scenario.name}`}
              className={styles.mediaViewerContent}
            />
          )}
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
              scenario={{ id: scenario.id, apiId: scenario.apiId, name: scenario.name, order: scenario.order }}
              gameMomentName={gameMomentName}
              zoneName={zoneName}
            />
          )}
        />
      ) : (
        <Typography className={styles.emptyZoneText}>No hay subprincipios definidos.</Typography>
      )}

      {clubId && scenario.apiId && (
        <PrincipleExercisesSection
          clubId={clubId}
          teamId={teamId}
          levelKind="scenario"
          levelApiId={scenario.apiId}
          levelName={scenario.name}
          contextLabel={`Escenario ${scenario.order}`}
          active={selectedPi === null}
          onCountChange={setExerciseCount}
        />
      )}
    </Box>
  );
}

interface PrincipleDetailProps {
  principle: Principle;
  clubId: string;
  teamId: string;
  gameMomentName: string;
  zoneName: string;
}

function PrincipleDetailView({ principle, clubId, teamId, gameMomentName, zoneName }: PrincipleDetailProps) {
  const [selectedSi, setSelectedSi] = useState<number | null>(principle.scenarios.length === 1 ? 0 : null);

  useEffect(() => {
    if (selectedSi !== null && selectedSi >= principle.scenarios.length) setSelectedSi(null);
  }, [principle.scenarios.length, selectedSi]);

  return (
    <Box className={styles.principleDetailView}>
      <Box className={styles.principleHeader}>
        <Typography component="h3" className={styles.principleTitle}>Principio: {principle.title}</Typography>
        {principle.description && (
          <Typography className={styles.principleDescription}>{principle.description}</Typography>
        )}
      </Box>

      {principle.scenarios.length > 0 ? (
        <DrillDownPanel<Scenario>
          items={principle.scenarios}
          getKey={(s) => s.id}
          selectedIndex={selectedSi}
          onSelect={setSelectedSi}
          onBack={() => setSelectedSi(null)}
          listAriaLabel="Lista de escenarios"
          emptyMessage="Selecciona un escenario para ver su detalle."
          detailTitle={(s) => `Escenario ${s.order}`}
          forceSinglePane
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
      ) : (
        <Typography className={styles.emptyZoneText}>No hay escenarios definidos.</Typography>
      )}
    </Box>
  );
}

export default function ScenarioAccordion({ principles, clubId, teamId, gameMomentName, zoneName }: Props) {
  const [selectedPi, setSelectedPi] = useState<number | null>(principles.length === 1 ? 0 : null);

  useEffect(() => {
    if (selectedPi !== null && selectedPi >= principles.length) setSelectedPi(null);
  }, [principles.length, selectedPi]);

  return (
    <DrillDownPanel<Principle>
      items={principles}
      getKey={(p) => p.id}
      selectedIndex={selectedPi}
      onSelect={setSelectedPi}
      onBack={() => setSelectedPi(null)}
      listAriaLabel="Lista de principios"
      emptyMessage="Selecciona un principio para ver su detalle."
      detailTitle={(p) => `Principio: ${p.title}`}
      renderListItem={(principle) => (
        <Box className={styles.listItemContent}>
          <Typography className={styles.listItemName}>{principle.title}</Typography>
          {principle.scenarios.length > 0 && (
            <Chip
              label={`${principle.scenarios.length} escenario${principle.scenarios.length !== 1 ? "s" : ""}`}
              size="small"
              className={styles.countChip}
            />
          )}
        </Box>
      )}
      renderDetail={(principle) => (
        <PrincipleDetailView
          principle={principle}
          clubId={clubId}
          teamId={teamId}
          gameMomentName={gameMomentName}
          zoneName={zoneName}
        />
      )}
    />
  );
}
