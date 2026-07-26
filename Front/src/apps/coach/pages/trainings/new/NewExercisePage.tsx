import { useEffect, useRef, useState } from "react";
import { Box, Button, CircularProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import ViewSidebarIcon from "@mui/icons-material/ViewSidebar";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import { useLocation, useNavigate } from "react-router-dom";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import trainingService from "../../../services/trainingService";
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
  const subSubPrincipleId = params.get("subSubPrincipleId");
  const subSubPrincipleName = params.get("sspName");
  const subPrincipleId = params.get("subPrincipleId");
  const subPrincipleName = params.get("spName");
  const scenarioId = params.get("scenarioId");
  const scenarioName = params.get("scenarioName");

  const navState = (location.state as NavState | null) ?? null;
  const returnTo = navState?.returnTo ?? "/coach/trainings";

  const halfPitchRef = useRef<HTMLDivElement>(null);
  const board = useTacticalBoard(halfPitchRef, teamId);
  const exerciseForm = useExerciseForm({
    clubId,
    subSubPrincipleId,
    subPrincipleId,
    scenarioId,
    navigate,
    returnTo,
    getBoardStateJson: board.serializeBoardStateJson,
  });

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

        <Box className={styles.workspace}>
          <Box className={styles.pitchArea}>
            <TacticalField halfPitchRef={halfPitchRef} board={board} />
          </Box>
          <ExerciseFormPanel
            panelVisible={panelVisible}
            subSubPrincipleId={subSubPrincipleId}
            subSubPrincipleName={subSubPrincipleName}
            subPrincipleId={subPrincipleId}
            subPrincipleName={subPrincipleName}
            scenarioId={scenarioId}
            scenarioName={scenarioName}
            form={exerciseForm}
          />
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
