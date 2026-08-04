import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Autocomplete,
  IconButton,
  Chip,
  Button,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import type { Scenario, SubPrinciple, SubSubPrinciple, TacticalPrinciple } from "../../../types/gameModel";
import { useGameModelDraft } from "../../../context/GameModelDraftContext";
import gameModelService from "../../../services/gameModelService";
import DrillDownPanel from "./DrillDownPanel";
import ScenarioMediaField from "./ScenarioMediaField";
import styles from "./ScenarioFormAccordion.module.css";

// ─── Skill row ───────────────────────────────────────────────────────

interface SkillRowProps {
  mi: number; zi: number; si: number; pi: number; qi: number; ki: number;
  name: string;
  description: string;
}

function SkillRow({ mi, zi, si, pi, qi, ki, name, description }: SkillRowProps) {
  const { dispatch } = useGameModelDraft();
  return (
    <Box className={styles.skillRow}>
      <TextField
        value={name}
        onChange={(e) =>
          dispatch({ type: "UPD_SKILL", mi, zi, si, pi, qi, ki, changes: { name: e.target.value } })
        }
        placeholder="Nombre de la habilidad"
        size="small"
        className={styles.skillNameField}
        variant="outlined"
      />
      <TextField
        value={description}
        onChange={(e) =>
          dispatch({ type: "UPD_SKILL", mi, zi, si, pi, qi, ki, changes: { description: e.target.value } })
        }
        placeholder="Descripción de la habilidad"
        size="small"
        className={styles.skillDescField}
        variant="outlined"
        multiline
        maxRows={3}
      />
      <Tooltip title="Eliminar habilidad">
        <IconButton
          size="small"
          className={styles.deleteIconBtn}
          onClick={() => dispatch({ type: "DEL_SKILL", mi, zi, si, pi, qi, ki })}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

// ─── SubSubPrinciple detail form ─────────────────────────────────────

interface SubSubPrincipleDetailFormProps {
  mi: number; zi: number; si: number; pi: number; qi: number;
  ssp: SubSubPrinciple;
}

function SubSubPrincipleDetailForm({ mi, zi, si, pi, qi, ssp }: SubSubPrincipleDetailFormProps) {
  const { dispatch } = useGameModelDraft();
  return (
    <Box className={styles.sspDetailForm}>
      <TextField
        value={ssp.name}
        onChange={(e) => dispatch({ type: "UPD_SSP", mi, zi, si, pi, qi, changes: { name: e.target.value } })}
        placeholder="Nombre del sub-subprincipio…"
        size="small"
        label="Nombre"
        fullWidth
        className={styles.detailNameField}
      />
      <TextField
        value={ssp.action}
        onChange={(e) => dispatch({ type: "UPD_SSP", mi, zi, si, pi, qi, changes: { action: e.target.value } })}
        placeholder="Acción: describe lo que hace el jugador en este momento…"
        multiline
        minRows={2}
        fullWidth
        size="small"
        className={styles.contextField}
        label="Acción"
      />
      <Box className={styles.skillsSection}>
        <Typography className={styles.sectionLabel}>Habilidades imprescindibles</Typography>
        {ssp.essentialSkills.map((sk, ki) => (
          <SkillRow key={sk.id} mi={mi} zi={zi} si={si} pi={pi} qi={qi} ki={ki} name={sk.name} description={sk.description} />
        ))}
        <Button
          size="small"
          startIcon={<AddIcon />}
          className={styles.addBtn}
          onClick={() => dispatch({ type: "ADD_SKILL", mi, zi, si, pi, qi })}
        >
          Añadir habilidad
        </Button>
      </Box>
    </Box>
  );
}

// ─── SubPrinciple detail form (hosts SubSubPrinciple DrillDownPanel) ─

interface SubPrincipleDetailFormProps {
  mi: number; zi: number; si: number; pi: number;
  sp: SubPrinciple;
}

function SubPrincipleDetailForm({ mi, zi, si, pi, sp }: SubPrincipleDetailFormProps) {
  const { dispatch } = useGameModelDraft();
  const [selectedQi, setSelectedQi] = useState<number | null>(sp.subSubPrinciples.length === 1 ? 0 : null);
  const [draggingSspIdx, setDraggingSspIdx] = useState<number | null>(null);
  const [dragOverSspIdx, setDragOverSspIdx] = useState<number | null>(null);

  useEffect(() => {
    if (selectedQi !== null && selectedQi >= sp.subSubPrinciples.length) setSelectedQi(null);
  }, [sp.subSubPrinciples.length, selectedQi]);

  return (
    <Box className={styles.spDetailForm}>
      <TextField
        value={sp.name}
        onChange={(e) => dispatch({ type: "UPD_SP", mi, zi, si, pi, changes: { name: e.target.value } })}
        placeholder="Nombre del subprincipio…"
        size="small"
        label="Nombre"
        fullWidth
        className={styles.detailNameField}
      />
      <TextField
        value={sp.context}
        onChange={(e) => dispatch({ type: "UPD_SP", mi, zi, si, pi, changes: { context: e.target.value } })}
        placeholder="Contexto del subprincipio: describe la situación de juego…"
        multiline
        minRows={2}
        fullWidth
        size="small"
        className={styles.contextField}
        label="Contexto"
      />

      <Box className={styles.nestedSection}>
        <Typography className={styles.sectionLabel}>Sub-subprincipios</Typography>
        <DrillDownPanel<SubSubPrinciple>
          items={sp.subSubPrinciples}
          getKey={(ssp) => ssp.id}
          selectedIndex={selectedQi}
          onSelect={setSelectedQi}
          onBack={() => setSelectedQi(null)}
          listAriaLabel="Lista de sub-subprincipios"
          emptyMessage="No hay sub-subprincipios. Añade el primero."
          detailTitle={(_ssp, qi) => `Sub-subprincipio ${qi + 1}`}
          renderListFooter={
            <Button
              size="small"
              startIcon={<AddIcon />}
              className={styles.addBtn}
              onClick={() => {
                const newIndex = sp.subSubPrinciples.length;
                dispatch({ type: "ADD_SSP", mi, zi, si, pi });
                setSelectedQi(newIndex);
              }}
            >
              Añadir sub-subprincipio
            </Button>
          }
          forceSinglePane
          renderListItem={(ssp, qi) => (
            <Box
              className={`${styles.dragRow}${draggingSspIdx === qi ? ` ${styles.isDragging}` : ""}${dragOverSspIdx === qi && draggingSspIdx !== qi ? ` ${styles.isDragOver}` : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverSspIdx(qi); }}
              onDragLeave={() => setDragOverSspIdx(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingSspIdx !== null && draggingSspIdx !== qi) {
                  dispatch({ type: "MOVE_SSP", mi, zi, si, pi, from: draggingSspIdx, to: qi });
                }
                setDraggingSspIdx(null);
                setDragOverSspIdx(null);
              }}
            >
              <Box
                component="span"
                className={styles.dragHandle}
                draggable
                onClick={(e) => e.stopPropagation()}
                onDragStart={(e: React.DragEvent) => {
                  e.stopPropagation();
                  e.dataTransfer.setData("text/plain", String(qi));
                  e.dataTransfer.effectAllowed = "move";
                  setDraggingSspIdx(qi);
                }}
                onDragEnd={() => { setDraggingSspIdx(null); setDragOverSspIdx(null); }}
              >
                <DragIndicatorIcon />
              </Box>
              <Box className={styles.reorderBtns}>
                <IconButton
                  size="small"
                  aria-label="Mover arriba"
                  className={styles.reorderBtn}
                  disabled={qi === 0}
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: "MOVE_SSP", mi, zi, si, pi, from: qi, to: qi - 1 }); }}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="Mover abajo"
                  className={styles.reorderBtn}
                  disabled={qi === sp.subSubPrinciples.length - 1}
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: "MOVE_SSP", mi, zi, si, pi, from: qi, to: qi + 1 }); }}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </Box>
              <Box className={styles.dragRowContent}>
                <Typography className={styles.sspNumber}>Sub-subprincipio {qi + 1}</Typography>
                <Typography className={styles.listItemName}>{ssp.name || "Sin nombre"}</Typography>
                {ssp.essentialSkills.length > 0 && (
                  <Chip label={`${ssp.essentialSkills.length} hab.`} size="small" className={styles.countChip} />
                )}
                <Tooltip title="Eliminar sub-subprincipio">
                  <IconButton
                    size="small"
                    className={styles.deleteIconBtn}
                    onClick={(e) => { e.stopPropagation(); dispatch({ type: "DEL_SSP", mi, zi, si, pi, qi }); }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          )}
          renderDetail={(ssp, qi) => (
            <SubSubPrincipleDetailForm mi={mi} zi={zi} si={si} pi={pi} qi={qi} ssp={ssp} />
          )}
        />
      </Box>
    </Box>
  );
}

// ─── Scenario detail form (hosts SubPrinciple DrillDownPanel) ───────

interface ScenarioDetailFormProps {
  mi: number; zi: number; si: number;
  scenario: Scenario;
}

function ScenarioDetailForm({ mi, zi, si, scenario }: ScenarioDetailFormProps) {
  const { dispatch, draft, availablePrinciples } = useGameModelDraft();
  const [selectedPi, setSelectedPi] = useState<number | null>(scenario.subPrinciples.length === 1 ? 0 : null);
  const [draggingSpIdx, setDraggingSpIdx] = useState<number | null>(null);
  const [dragOverSpIdx, setDragOverSpIdx] = useState<number | null>(null);
  const [targetMi, setTargetMi] = useState(mi);
  const [targetZi, setTargetZi] = useState(zi);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (selectedPi !== null && selectedPi >= scenario.subPrinciples.length) setSelectedPi(null);
  }, [scenario.subPrinciples.length, selectedPi]);

  const isSameLocation = targetMi === mi && targetZi === zi;
  const targetZoneOptions = draft.gameMoments[targetMi]?.zones ?? [];

  const handleMomentChange = (e: SelectChangeEvent<number>) => {
    const newMi = Number(e.target.value);
    setTargetMi(newMi);
    setTargetZi(0);
  };

  const handleMove = async () => {
    if (isSameLocation) return;
    setMoving(true);
    try {
      if (scenario.apiId) {
        const targetMoment = draft.gameMoments[targetMi];
        const targetZone = targetMoment.zones[targetZi];
        const { order } = await gameModelService.moveScenarioLocation(
          scenario.apiId,
          targetMoment.id,
          targetZone.id
        );
        dispatch({ type: "MOVE_SCENARIO_LOCATION", fromMi: mi, fromZi: zi, si, toMi: targetMi, toZi: targetZi, order });
      } else {
        dispatch({ type: "MOVE_SCENARIO_LOCATION", fromMi: mi, fromZi: zi, si, toMi: targetMi, toZi: targetZi });
      }
    } catch {
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: { message: "No se pudo mover el escenario.", severity: "error" },
        })
      );
    } finally {
      setMoving(false);
    }
  };

  return (
    <Box className={styles.scenarioDetailForm}>
      <Box className={styles.moveSection}>
        <Typography className={styles.sectionLabel}>Mover a…</Typography>
        <Box className={styles.moveControls}>
          <FormControl size="small" className={styles.moveSelect}>
            <InputLabel id={`move-moment-label-${scenario.id}`}>Momento</InputLabel>
            <Select
              labelId={`move-moment-label-${scenario.id}`}
              label="Momento"
              value={targetMi}
              onChange={handleMomentChange}
              data-testid="scenario-move-moment-select"
            >
              {draft.gameMoments.map((m, idx) => (
                <MenuItem key={m.id} value={idx}>
                  {m.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" className={styles.moveSelect}>
            <InputLabel id={`move-zone-label-${scenario.id}`}>Zona</InputLabel>
            <Select
              labelId={`move-zone-label-${scenario.id}`}
              label="Zona"
              value={targetZi}
              onChange={(e) => setTargetZi(Number(e.target.value))}
              data-testid="scenario-move-zone-select"
            >
              {targetZoneOptions.map((z, idx) => (
                <MenuItem key={z.id} value={idx}>
                  {z.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            size="small"
            variant="outlined"
            className={styles.moveBtn}
            disabled={isSameLocation || moving}
            aria-label="Mover escenario"
            onClick={handleMove}
          >
            Mover
          </Button>
        </Box>
      </Box>
      <TextField
        value={scenario.name}
        onChange={(e) => dispatch({ type: "UPD_SCENARIO", mi, zi, si, changes: { name: e.target.value } })}
        placeholder="Nombre del escenario…"
        size="small"
        label="Nombre"
        fullWidth
        className={styles.detailNameField}
      />
      <TextField
        value={scenario.context}
        onChange={(e) => dispatch({ type: "UPD_SCENARIO", mi, zi, si, changes: { context: e.target.value } })}
        placeholder="Contexto: describe la situación del juego en este escenario…"
        multiline
        minRows={2}
        fullWidth
        size="small"
        className={styles.contextField}
        label="Contexto"
      />
      <Autocomplete
        multiple
        options={availablePrinciples}
        getOptionLabel={(o: TacticalPrinciple) => o.name}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        value={scenario.tacticalPrinciples}
        onChange={(_, value) => dispatch({ type: "UPD_SCENARIO", mi, zi, si, changes: { tacticalPrinciples: value } })}
        renderInput={(params) => (
          <TextField {...params} label="Principios tácticos colectivos" size="small" className={styles.principlesField} />
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => {
            const { key, ...tagProps } = getTagProps({ index });
            return <Chip key={key} label={option.name} size="small" {...tagProps} className={styles.principleChip} />;
          })
        }
        className={styles.principlesAutocomplete}
      />

      {scenario.apiId ? (
        <ScenarioMediaField
          scenarioApiId={scenario.apiId}
          mediaUrl={scenario.mediaUrl}
          mediaType={scenario.mediaType}
          onChange={(mediaUrl, mediaType) =>
            dispatch({ type: "UPD_SCENARIO", mi, zi, si, changes: { mediaUrl, mediaType } })
          }
        />
      ) : (
        <Typography className={styles.mediaHint} color="text.secondary">
          Guarda el modelo de juego para poder añadir una foto o vídeo a este escenario.
        </Typography>
      )}

      <Box className={styles.nestedSection}>
        <Typography className={styles.sectionLabel}>Subprincipios</Typography>
        <DrillDownPanel<SubPrinciple>
          items={scenario.subPrinciples}
          getKey={(sp) => sp.id}
          selectedIndex={selectedPi}
          onSelect={setSelectedPi}
          onBack={() => setSelectedPi(null)}
          listAriaLabel="Lista de subprincipios"
          emptyMessage="No hay subprincipios. Añade el primero."
          detailTitle={(sp) => `Subprincipio ${sp.label}`}
          renderListFooter={
            <Button
              size="small"
              startIcon={<AddIcon />}
              className={styles.addBtn}
              onClick={() => {
                const newIndex = scenario.subPrinciples.length;
                dispatch({ type: "ADD_SP", mi, zi, si });
                setSelectedPi(newIndex);
              }}
            >
              Añadir subprincipio
            </Button>
          }
          forceSinglePane
          renderListItem={(sp, pi) => (
            <Box
              className={`${styles.dragRow}${draggingSpIdx === pi ? ` ${styles.isDragging}` : ""}${dragOverSpIdx === pi && draggingSpIdx !== pi ? ` ${styles.isDragOver}` : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverSpIdx(pi); }}
              onDragLeave={() => setDragOverSpIdx(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingSpIdx !== null && draggingSpIdx !== pi) {
                  dispatch({ type: "MOVE_SP", mi, zi, si, from: draggingSpIdx, to: pi });
                }
                setDraggingSpIdx(null);
                setDragOverSpIdx(null);
              }}
            >
              <Box
                component="span"
                className={styles.dragHandle}
                draggable
                onClick={(e) => e.stopPropagation()}
                onDragStart={(e: React.DragEvent) => {
                  e.stopPropagation();
                  e.dataTransfer.setData("text/plain", String(pi));
                  e.dataTransfer.effectAllowed = "move";
                  setDraggingSpIdx(pi);
                }}
                onDragEnd={() => { setDraggingSpIdx(null); setDragOverSpIdx(null); }}
              >
                <DragIndicatorIcon />
              </Box>
              <Box className={styles.reorderBtns}>
                <IconButton
                  size="small"
                  aria-label="Mover arriba"
                  className={styles.reorderBtn}
                  disabled={pi === 0}
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: "MOVE_SP", mi, zi, si, from: pi, to: pi - 1 }); }}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="Mover abajo"
                  className={styles.reorderBtn}
                  disabled={pi === scenario.subPrinciples.length - 1}
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: "MOVE_SP", mi, zi, si, from: pi, to: pi + 1 }); }}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </Box>
              <Box className={styles.dragRowContent}>
                <Typography className={styles.spLabel}>Subprincipio {sp.label}</Typography>
                <Typography className={styles.listItemName}>{sp.name || "Sin nombre"}</Typography>
                {sp.subSubPrinciples.length > 0 && (
                  <Chip
                    label={`${sp.subSubPrinciples.length} sub-subprincipio${sp.subSubPrinciples.length !== 1 ? "s" : ""}`}
                    size="small"
                    className={styles.countChip}
                  />
                )}
                <Tooltip title="Eliminar subprincipio">
                  <IconButton
                    size="small"
                    className={styles.deleteIconBtn}
                    onClick={(e) => { e.stopPropagation(); dispatch({ type: "DEL_SP", mi, zi, si, pi }); }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          )}
          renderDetail={(sp, pi) => <SubPrincipleDetailForm mi={mi} zi={zi} si={si} pi={pi} sp={sp} />}
        />
      </Box>
    </Box>
  );
}

// ─── ScenarioFormAccordion (default export) — one instance per Zone ─

interface Props {
  mi: number;
  zi: number;
  scenarios: Scenario[];
}

export default function ScenarioFormAccordion({ mi, zi, scenarios: initialScenarios }: Props) {
  const { dispatch, draft } = useGameModelDraft();
  const scenarios = draft.gameMoments[mi]?.zones[zi]?.scenarios || initialScenarios;
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
      emptyMessage="No hay escenarios. Añade el primero."
      detailTitle={(s) => `Escenario ${s.order}`}
      renderListFooter={
        <Button
          size="small"
          startIcon={<AddIcon />}
          className={styles.addBtn}
          onClick={() => {
            const newIndex = scenarios.length;
            dispatch({ type: "ADD_SCENARIO", mi, zi });
            setSelectedSi(newIndex);
          }}
        >
          Añadir escenario
        </Button>
      }
      renderListItem={(scenario, si) => (
        <Box className={styles.listItemContent}>
          <Typography className={styles.scenarioNumber}>Escenario {scenario.order}</Typography>
          <Typography className={styles.listItemName}>{scenario.name || "Sin nombre"}</Typography>
          {scenario.subPrinciples.length > 0 && (
            <Chip
              label={`${scenario.subPrinciples.length} subprincipio${scenario.subPrinciples.length !== 1 ? "s" : ""}`}
              size="small"
              className={styles.countChip}
            />
          )}
          <Tooltip title="Eliminar escenario">
            <IconButton
              size="small"
              className={styles.deleteIconBtn}
              onClick={(e) => { e.stopPropagation(); dispatch({ type: "DEL_SCENARIO", mi, zi, si }); }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      renderDetail={(scenario, si) => <ScenarioDetailForm mi={mi} zi={zi} si={si} scenario={scenario} />}
    />
  );
}
