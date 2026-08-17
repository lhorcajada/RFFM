import { useEffect, useRef, useState } from "react";
import { Box, Button, Chip, CircularProgress, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import ViewSidebarIcon from "@mui/icons-material/ViewSidebar";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import { useLocation, useNavigate } from "react-router-dom";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import trainingService from "../../../services/trainingService";
import seasonPlanService from "../../../services/seasonPlanService";
import seasonService from "../../../services/seasonService";
import { GAME_ZONE_LABELS } from "../season-plan/gameZoneLabels";
import type { AdnSubprincipioSummary, AdnSubSubPrincipioSummary } from "../../../types/seasonPlan";
import styles from "./NewExercisePage.module.css";
import ChapasStrip from "./components/ChapasStrip";
import ExerciseFormPanel from "./components/ExerciseFormPanel";
import LinesStrip from "./components/LinesStrip";
import MaterialsStrip from "./components/MaterialsStrip";
import SpacesStrip from "./components/SpacesStrip";
import TextsStrip from "./components/TextsStrip";
import TacticalField from "./components/TacticalField";
import { useExerciseForm } from "./hooks/useExerciseForm";
import { useTacticalBoard } from "./hooks/useTacticalBoard";
import type { NavState } from "./types";


export default function NewExercisePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const clubId = params.get("clubId") ?? "";
  const teamId = params.get("teamId") ?? "";
  const exerciseId = params.get("exerciseId");
  const duplicateFromId = params.get("duplicateFrom");
  const microcicloId = params.get("microcicloId");

  const navState = (location.state as NavState | null) ?? null;
  const returnTo = navState?.returnTo ?? "/coach/trainings";

  const halfPitchRef = useRef<HTMLDivElement>(null);
  const board = useTacticalBoard(halfPitchRef, teamId);
  const exerciseForm = useExerciseForm({
    clubId,
    navigate,
    returnTo,
    getBoardStateJson: board.serializeBoardStateJson,
    microcicloId,
  });

  // Read-only context banner: the Microciclo's week label + its parent Mesociclo's zone,
  // shown above the form when creating an exercise from the Planificación tab. Also shows
  // each session's linked ADN targets (Subprincipio/SubSubPrincipio/Habilidad) — the create
  // flow doesn't currently know whether the exercise is "for" Sesión A or B, so both
  // sessions' chips are shown, clearly labeled, rather than guessing which one applies.
  interface SessionAdnContext {
    subprincipios: AdnSubprincipioSummary[];
    subSubPrincipios: AdnSubSubPrincipioSummary[];
    habilidades: string[];
  }
  const [microcicloContext, setMicrocicloContext] = useState<{
    weekLabel: string;
    zoneLabel: string;
    sesionA: SessionAdnContext;
    sesionB: SessionAdnContext;
  } | null>(null);

  useEffect(() => {
    if (!microcicloId || !teamId) return;
    let cancelled = false;

    async function loadContext() {
      const activeSeason = await seasonService.getActiveSeason();
      if (!activeSeason?.id) return;
      const plan = await seasonPlanService.getByTeamIdAndSeason(teamId, activeSeason.id);
      if (cancelled || !plan) return;

      for (const macrociclo of plan.macrociclos) {
        for (const mesociclo of macrociclo.mesociclos) {
          const microciclo = mesociclo.microciclos.find((m) => m.apiId === microcicloId);
          if (microciclo) {
            setMicrocicloContext({
              weekLabel: microciclo.weekLabel,
              zoneLabel: GAME_ZONE_LABELS[mesociclo.gameZoneId] ?? "",
              sesionA: {
                subprincipios: microciclo.sesionASubprincipios,
                subSubPrincipios: microciclo.sesionASubSubPrincipios,
                habilidades: microciclo.sesionAHabilidades,
              },
              sesionB: {
                subprincipios: microciclo.sesionBSubprincipios,
                subSubPrincipios: microciclo.sesionBSubSubPrincipios,
                habilidades: microciclo.sesionBHabilidades,
              },
            });
            return;
          }
        }
      }
    }

    void loadContext();
    return () => {
      cancelled = true;
    };
  }, [microcicloId, teamId]);

  useEffect(() => {
    const sourceId = exerciseId ?? duplicateFromId;
    if (!sourceId) return;

    let cancelled = false;

    void trainingService.getExerciseById(sourceId).then((exercise) => {
      if (cancelled || !exercise) return;
      if (duplicateFromId) {
        exerciseForm.loadExerciseAsCopy(exercise);
      } else {
        exerciseForm.loadExercise(exercise);
      }
      board.loadBoardStateJson(exercise.boardStateJson);
    });

    return () => {
      cancelled = true;
    };
  }, [exerciseId, duplicateFromId]);

  const [panelVisible, setPanelVisible] = useState(false);
  useEffect(() => { setPanelVisible(true); }, []);

  return (
    <BaseLayout hideFooterMenu>
      <Box className={styles.page}>
        <Box className={styles.topBar}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={exerciseForm.handleCancel}
            disabled={exerciseForm.saving}
            variant="outlined"
            size="small"
          >
            Cancelar
          </Button>
          <Button
            startIcon={<SaveIcon />}
            onClick={exerciseForm.handleSave}
            disabled={exerciseForm.saving}
            variant="contained"
            size="small"
            className={styles.saveBtn}
          >
            {exerciseForm.saving ? <CircularProgress size={16} /> : "Guardar"}
          </Button>
        </Box>

        {microcicloContext && (
          <Box className={styles.microcicloBanner}>
            <Typography className={styles.microcicloBannerText}>
              Vinculado a <strong>{microcicloContext.weekLabel}</strong>
              {microcicloContext.zoneLabel ? ` · ${microcicloContext.zoneLabel}` : ""}
            </Typography>
            {([
              ["A", microcicloContext.sesionA],
              ["B", microcicloContext.sesionB],
            ] as const).map(([sessionLabel, session]) => {
              const hasLinks =
                session.subprincipios.length > 0 || session.subSubPrincipios.length > 0 || session.habilidades.length > 0;
              if (!hasLinks) return null;

              return (
                <Box key={sessionLabel} className={styles.microcicloBannerSession}>
                  <Typography className={styles.microcicloBannerSessionLabel}>Sesión {sessionLabel}</Typography>
                  <Box className={styles.microcicloBannerChips}>
                    {session.subprincipios.map((s) => (
                      <Chip key={s.id} label={`${s.titulo} ${s.numero}`} size="small" className={styles.microcicloBannerChip} />
                    ))}
                    {session.subSubPrincipios.map((s) => (
                      <Chip
                        key={s.id}
                        label={`${s.numero} · ${s.rol}`}
                        size="small"
                        className={styles.microcicloBannerChip}
                      />
                    ))}
                    {session.habilidades.map((h) => (
                      <Chip key={h} label={h} size="small" className={styles.microcicloBannerHabilidadChip} />
                    ))}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}

        <Box className={styles.workspace}>
          <Box className={styles.pitchArea}>
            <TacticalField halfPitchRef={halfPitchRef} board={board} />
          </Box>
          <ExerciseFormPanel panelVisible={panelVisible} form={exerciseForm} teamId={teamId} />
        </Box>

        {board.showChapas && <ChapasStrip board={board} />}
        {board.showSpaces && <SpacesStrip board={board} />}
        {board.showMaterials && <MaterialsStrip board={board} />}
        {board.showLines && <LinesStrip board={board} />}
        {board.showTexts && <TextsStrip board={board} selectedTextId={board.selectedTextId} />}

        <Box className={styles.bottomToolBar}>
          <Button
            size="small"
            variant={board.showChapas ? "contained" : "outlined"}
            startIcon={<SportsSoccerIcon />}
            className={styles.toolBtn}
            onClick={board.handleToggleChapas}
          >
            Chapas
          </Button>
          <Button
            size="small"
            variant={board.showSpaces ? "contained" : "outlined"}
            startIcon={<ViewSidebarIcon />}
            className={styles.toolBtn}
            onClick={board.handleToggleSpaces}
          >
            Espacios
          </Button>
          <Button
            size="small"
            variant={board.showMaterials ? "contained" : "outlined"}
            className={styles.toolBtn}
            onClick={board.handleToggleMaterials}
          >
            Material
          </Button>
          <Button
            size="small"
            variant={board.showLines ? "contained" : "outlined"}
            className={styles.toolBtn}
            onClick={board.handleToggleLines}
          >
            Lineas
          </Button>
          <Button
            size="small"
            variant={board.showTexts ? "contained" : "outlined"}
            startIcon={<TextFieldsIcon />}
            className={styles.toolBtn}
            onClick={board.handleToggleTexts}
          >
            Texto
          </Button>
        </Box>
      </Box>
    </BaseLayout>
  );
}
