import { useEffect, useRef, useState } from "react";
import { Box, Button, CircularProgress, TextField, useTheme } from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import ViewSidebarIcon from "@mui/icons-material/ViewSidebar";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import ChangeHistoryIcon from "@mui/icons-material/ChangeHistory";
import CallMadeIcon from "@mui/icons-material/CallMade";
import { useLocation, useNavigate } from "react-router-dom";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import trainingService from "../../../services/trainingService";
import styles from "./NewExercisePage.module.css";
import ChapasStrip from "./components/ChapasStrip";
import ExerciseFormPanel from "./components/ExerciseFormPanel";
import LinesStrip from "./components/LinesStrip";
import MaterialsStrip from "./components/MaterialsStrip";
import MobileEditorBlocked from "./components/MobileEditorBlocked";
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

  const navState = (location.state as NavState | null) ?? null;
  const returnTo = navState?.returnTo ?? "/coach/trainings";

  const halfPitchRef = useRef<HTMLDivElement>(null);
  const board = useTacticalBoard(halfPitchRef, teamId);
  const exerciseForm = useExerciseForm({
    clubId,
    navigate,
    returnTo,
    returnState: navState?.returnState,
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

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down(700));

  const tools = [
    { label: "Chapas", icon: <SportsSoccerIcon />, active: board.showChapas, toggle: board.handleToggleChapas },
    { label: "Espacios", icon: <ViewSidebarIcon />, active: board.showSpaces, toggle: board.handleToggleSpaces },
    { label: "Material", icon: <ChangeHistoryIcon />, active: board.showMaterials, toggle: board.handleToggleMaterials },
    { label: "Líneas", icon: <CallMadeIcon />, active: board.showLines, toggle: board.handleToggleLines },
    { label: "Texto", icon: <TextFieldsIcon />, active: board.showTexts, toggle: board.handleToggleTexts },
  ];

  if (isMobile) {
    return (
      <BaseLayout hideFooterMenu>
        <MobileEditorBlocked onBack={exerciseForm.handleCancel} />
      </BaseLayout>
    );
  }

  return (
    <BaseLayout hideFooterMenu>
      <Box className={styles.page}>
        <Box className={styles.topBar}>
          <TextField
            label="Título"
            value={exerciseForm.form.name}
            onChange={(e) => exerciseForm.setField("name", e.target.value)}
            size="small"
            className={styles.titleField}
          />
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
          <Box component="nav" aria-label="Herramientas de pizarra" className={styles.toolRail}>
            {tools.map((tool) => (
              <button
                key={tool.label}
                type="button"
                aria-pressed={tool.active}
                aria-label={tool.label}
                className={`${styles.railBtn} ${tool.active ? styles.railBtnActive : ""}`}
                onClick={tool.toggle}
              >
                {tool.icon}
                <span aria-hidden="true">{tool.label}</span>
              </button>
            ))}
          </Box>
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

      </Box>
    </BaseLayout>
  );
}
