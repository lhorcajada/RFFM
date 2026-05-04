import { useEffect, useRef, useState } from "react";
import { Box, Button, CircularProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import ViewSidebarIcon from "@mui/icons-material/ViewSidebar";
import { useLocation, useNavigate } from "react-router-dom";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import styles from "./NewExercisePage.module.css";
import ChapasStrip from "./components/ChapasStrip";
import ExerciseFormPanel from "./components/ExerciseFormPanel";
import LinesStrip from "./components/LinesStrip";
import MaterialsStrip from "./components/MaterialsStrip";
import SpacesStrip from "./components/SpacesStrip";
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
  const subSubPrincipleId = params.get("subSubPrincipleId");
  const subSubPrincipleName = params.get("sspName");

  const navState = (location.state as NavState | null) ?? null;
  const returnTo = navState?.returnTo ?? "/coach/trainings";

  const halfPitchRef = useRef<HTMLDivElement>(null);
  const board = useTacticalBoard(halfPitchRef, teamId);
  const exerciseForm = useExerciseForm({ clubId, subSubPrincipleId, navigate, returnTo });

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
            form={exerciseForm}
          />
        </Box>

        {board.showChapas && <ChapasStrip board={board} />}
        {board.showSpaces && <SpacesStrip board={board} />}
        {board.showMaterials && <MaterialsStrip board={board} />}
        {board.showLines && <LinesStrip board={board} />}

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
        </Box>
      </Box>
    </BaseLayout>
  );
}
