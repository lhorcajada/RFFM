import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  TextField,
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
import type { Principle, Scenario, SubPrinciple, SubSubPrinciple } from "../../../types/gameModel";
import { useGameModelDraft } from "../../../context/GameModelDraftContext";
import gameModelService from "../../../services/gameModelService";
import DrillDownPanel from "./DrillDownPanel";
import ScenarioMediaField from "./ScenarioMediaField";
import styles from "./ScenarioFormAccordion.module.css";

// ─── Skill row ───────────────────────────────────────────────────────

interface SkillRowProps {
  mi: number; zi: number; pi: number; si: number; spi: number; qi: number; ki: number;
  name: string;
  description: string;
}

function SkillRow({ mi, zi, pi, si, spi, qi, ki, name, description }: SkillRowProps) {
  const { dispatch } = useGameModelDraft();
  return (
    <Box className={styles.skillRow}>
      <TextField
        value={name}
        onChange={(e) =>
          dispatch({ type: "UPD_SKILL", mi, zi, pi, si, spi, qi, ki, changes: { name: e.target.value } })
        }
        placeholder="Nombre de la habilidad"
        size="small"
        className={styles.skillNameField}
        variant="outlined"
      />
      <TextField
        value={description}
        onChange={(e) =>
          dispatch({ type: "UPD_SKILL", mi, zi, pi, si, spi, qi, ki, changes: { description: e.target.value } })
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
          onClick={() => dispatch({ type: "DEL_SKILL", mi, zi, pi, si, spi, qi, ki })}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

// ─── SubSubPrinciple detail form ─────────────────────────────────────

interface SubSubPrincipleDetailFormProps {
  mi: number; zi: number; pi: number; si: number; spi: number; qi: number;
  ssp: SubSubPrinciple;
}

function SubSubPrincipleDetailForm({ mi, zi, pi, si, spi, qi, ssp }: SubSubPrincipleDetailFormProps) {
  const { dispatch } = useGameModelDraft();
  return (
    <Box className={styles.sspDetailForm}>
      <TextField
        value={ssp.name}
        onChange={(e) => dispatch({ type: "UPD_SSP", mi, zi, pi, si, spi, qi, changes: { name: e.target.value } })}
        placeholder="Nombre del sub-subprincipio…"
        size="small"
        label="Nombre"
        fullWidth
        className={styles.detailNameField}
      />
      <TextField
        value={ssp.action}
        onChange={(e) => dispatch({ type: "UPD_SSP", mi, zi, pi, si, spi, qi, changes: { action: e.target.value } })}
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
          <SkillRow key={sk.id} mi={mi} zi={zi} pi={pi} si={si} spi={spi} qi={qi} ki={ki} name={sk.name} description={sk.description} />
        ))}
        <Button
          size="small"
          startIcon={<AddIcon />}
          className={styles.addBtn}
          onClick={() => dispatch({ type: "ADD_SKILL", mi, zi, pi, si, spi, qi })}
        >
          Añadir habilidad
        </Button>
      </Box>
    </Box>
  );
}

// ─── SubPrinciple detail form (hosts SubSubPrinciple DrillDownPanel) ─

interface SubPrincipleDetailFormProps {
  mi: number; zi: number; pi: number; si: number; spi: number;
  sp: SubPrinciple;
}

function SubPrincipleDetailForm({ mi, zi, pi, si, spi, sp }: SubPrincipleDetailFormProps) {
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
        onChange={(e) => dispatch({ type: "UPD_SP", mi, zi, pi, si, spi, changes: { name: e.target.value } })}
        placeholder="Nombre del subprincipio…"
        size="small"
        label="Nombre"
        fullWidth
        className={styles.detailNameField}
      />
      <TextField
        value={sp.context}
        onChange={(e) => dispatch({ type: "UPD_SP", mi, zi, pi, si, spi, changes: { context: e.target.value } })}
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
                dispatch({ type: "ADD_SSP", mi, zi, pi, si, spi });
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
                  dispatch({ type: "MOVE_SSP", mi, zi, pi, si, spi, from: draggingSspIdx, to: qi });
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
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: "MOVE_SSP", mi, zi, pi, si, spi, from: qi, to: qi - 1 }); }}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="Mover abajo"
                  className={styles.reorderBtn}
                  disabled={qi === sp.subSubPrinciples.length - 1}
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: "MOVE_SSP", mi, zi, pi, si, spi, from: qi, to: qi + 1 }); }}
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
                    onClick={(e) => { e.stopPropagation(); dispatch({ type: "DEL_SSP", mi, zi, pi, si, spi, qi }); }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          )}
          renderDetail={(ssp, qi) => (
            <SubSubPrincipleDetailForm mi={mi} zi={zi} pi={pi} si={si} spi={spi} qi={qi} ssp={ssp} />
          )}
        />
      </Box>
    </Box>
  );
}

// ─── Scenario detail form (hosts SubPrinciple DrillDownPanel) ───────

interface ScenarioDetailFormProps {
  mi: number; zi: number; pi: number; si: number;
  scenario: Scenario;
}

interface MoveTargetOption {
  mi: number;
  zi: number;
  pi: number;
  label: string;
  apiId?: string;
}

function ScenarioDetailForm({ mi, zi, pi, si, scenario }: ScenarioDetailFormProps) {
  const { dispatch, draft } = useGameModelDraft();
  const [selectedSpi, setSelectedSpi] = useState<number | null>(scenario.subPrinciples.length === 1 ? 0 : null);
  const [draggingSpIdx, setDraggingSpIdx] = useState<number | null>(null);
  const [dragOverSpIdx, setDragOverSpIdx] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (selectedSpi !== null && selectedSpi >= scenario.subPrinciples.length) setSelectedSpi(null);
  }, [scenario.subPrinciples.length, selectedSpi]);

  const allTargets: MoveTargetOption[] = draft.gameMoments.flatMap((m, tmi) =>
    m.zones.flatMap((z, tzi) =>
      z.principles.map((p, tpi) => ({
        mi: tmi,
        zi: tzi,
        pi: tpi,
        apiId: p.apiId,
        label: `${m.name} · ${z.name} · ${p.title || "Sin título"}`,
      }))
    )
  );

  const moveTargets = allTargets.filter((opt) => {
    const isCurrent = opt.mi === mi && opt.zi === zi && opt.pi === pi;
    if (isCurrent) return false;
    if (scenario.apiId) return !!opt.apiId;
    return true;
  });

  const [targetKey, setTargetKey] = useState<string>(moveTargets[0] ? keyOf(moveTargets[0]) : "");

  useEffect(() => {
    if (!moveTargets.some((t) => keyOf(t) === targetKey)) {
      setTargetKey(moveTargets[0] ? keyOf(moveTargets[0]) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveTargets.length]);

  function keyOf(opt: MoveTargetOption) {
    return `${opt.mi}:${opt.zi}:${opt.pi}`;
  }

  const handleTargetChange = (e: SelectChangeEvent<string>) => {
    setTargetKey(e.target.value);
  };

  const handleMove = async () => {
    const target = moveTargets.find((t) => keyOf(t) === targetKey);
    if (!target) return;
    setMoving(true);
    try {
      if (scenario.apiId && target.apiId) {
        const { order } = await gameModelService.moveScenarioToPrinciple(scenario.apiId, target.apiId);
        dispatch({
          type: "MOVE_SCENARIO_LOCATION",
          fromMi: mi, fromZi: zi, fromPi: pi, si,
          toMi: target.mi, toZi: target.zi, toPi: target.pi,
          order,
        });
      } else {
        dispatch({
          type: "MOVE_SCENARIO_LOCATION",
          fromMi: mi, fromZi: zi, fromPi: pi, si,
          toMi: target.mi, toZi: target.zi, toPi: target.pi,
        });
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
      {moveTargets.length > 0 && (
        <Box className={styles.moveSection}>
          <Typography className={styles.sectionLabel}>Mover a…</Typography>
          <Box className={styles.moveControls}>
            <FormControl size="small" className={styles.moveSelect}>
              <InputLabel id={`move-principle-label-${scenario.id}`}>Principio</InputLabel>
              <Select
                labelId={`move-principle-label-${scenario.id}`}
                label="Principio"
                value={targetKey}
                onChange={handleTargetChange}
                data-testid="scenario-move-principle-select"
              >
                {moveTargets.map((opt) => (
                  <MenuItem key={keyOf(opt)} value={keyOf(opt)}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              size="small"
              variant="outlined"
              className={styles.moveBtn}
              disabled={!targetKey || moving}
              aria-label="Mover escenario"
              onClick={handleMove}
            >
              Mover
            </Button>
          </Box>
        </Box>
      )}
      <TextField
        value={scenario.name}
        onChange={(e) => dispatch({ type: "UPD_SCENARIO", mi, zi, pi, si, changes: { name: e.target.value } })}
        placeholder="Nombre del escenario…"
        size="small"
        label="Nombre"
        fullWidth
        className={styles.detailNameField}
      />
      <TextField
        value={scenario.context}
        onChange={(e) => dispatch({ type: "UPD_SCENARIO", mi, zi, pi, si, changes: { context: e.target.value } })}
        placeholder="Contexto: describe la situación del juego en este escenario…"
        multiline
        minRows={2}
        fullWidth
        size="small"
        className={styles.contextField}
        label="Contexto"
      />

      {scenario.apiId ? (
        <ScenarioMediaField
          scenarioApiId={scenario.apiId}
          mediaUrl={scenario.mediaUrl}
          mediaType={scenario.mediaType}
          onChange={(mediaUrl, mediaType) =>
            dispatch({ type: "UPD_SCENARIO", mi, zi, pi, si, changes: { mediaUrl, mediaType } })
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
          selectedIndex={selectedSpi}
          onSelect={setSelectedSpi}
          onBack={() => setSelectedSpi(null)}
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
                dispatch({ type: "ADD_SP", mi, zi, pi, si });
                setSelectedSpi(newIndex);
              }}
            >
              Añadir subprincipio
            </Button>
          }
          forceSinglePane
          renderListItem={(sp, spi) => (
            <Box
              className={`${styles.dragRow}${draggingSpIdx === spi ? ` ${styles.isDragging}` : ""}${dragOverSpIdx === spi && draggingSpIdx !== spi ? ` ${styles.isDragOver}` : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverSpIdx(spi); }}
              onDragLeave={() => setDragOverSpIdx(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingSpIdx !== null && draggingSpIdx !== spi) {
                  dispatch({ type: "MOVE_SP", mi, zi, pi, si, from: draggingSpIdx, to: spi });
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
                  e.dataTransfer.setData("text/plain", String(spi));
                  e.dataTransfer.effectAllowed = "move";
                  setDraggingSpIdx(spi);
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
                  disabled={spi === 0}
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: "MOVE_SP", mi, zi, pi, si, from: spi, to: spi - 1 }); }}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="Mover abajo"
                  className={styles.reorderBtn}
                  disabled={spi === scenario.subPrinciples.length - 1}
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: "MOVE_SP", mi, zi, pi, si, from: spi, to: spi + 1 }); }}
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
                    onClick={(e) => { e.stopPropagation(); dispatch({ type: "DEL_SP", mi, zi, pi, si, spi }); }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          )}
          renderDetail={(sp, spi) => <SubPrincipleDetailForm mi={mi} zi={zi} pi={pi} si={si} spi={spi} sp={sp} />}
        />
      </Box>
    </Box>
  );
}

// ─── Scenario list (hosts Scenario DrillDownPanel) — nested inside a Principio ─

interface ScenarioListFormProps {
  mi: number; zi: number; pi: number;
  scenarios: Scenario[];
}

function ScenarioListForm({ mi, zi, pi, scenarios }: ScenarioListFormProps) {
  const { dispatch } = useGameModelDraft();
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
      forceSinglePane
      renderListFooter={
        <Button
          size="small"
          startIcon={<AddIcon />}
          className={styles.addBtn}
          onClick={() => {
            const newIndex = scenarios.length;
            dispatch({ type: "ADD_SCENARIO", mi, zi, pi });
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
              onClick={(e) => { e.stopPropagation(); dispatch({ type: "DEL_SCENARIO", mi, zi, pi, si }); }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      renderDetail={(scenario, si) => <ScenarioDetailForm mi={mi} zi={zi} pi={pi} si={si} scenario={scenario} />}
    />
  );
}

// ─── Principle detail form (title/description + nested scenarios) ───

interface PrincipleDetailFormProps {
  mi: number; zi: number; pi: number;
  principle: Principle;
}

function PrincipleDetailForm({ mi, zi, pi, principle }: PrincipleDetailFormProps) {
  const { dispatch } = useGameModelDraft();
  return (
    <Box className={styles.principleDetailForm}>
      <TextField
        value={principle.title}
        onChange={(e) => dispatch({ type: "UPD_PRINCIPLE", mi, zi, pi, changes: { title: e.target.value } })}
        placeholder="Título del principio…"
        size="small"
        label="Título"
        fullWidth
        className={styles.detailNameField}
      />
      <TextField
        value={principle.description}
        onChange={(e) => dispatch({ type: "UPD_PRINCIPLE", mi, zi, pi, changes: { description: e.target.value } })}
        placeholder="Descripción del principio…"
        multiline
        minRows={2}
        fullWidth
        size="small"
        className={styles.contextField}
        label="Descripción"
      />
      <Box className={styles.nestedSection}>
        <Typography className={styles.sectionLabel}>Escenarios</Typography>
        <ScenarioListForm mi={mi} zi={zi} pi={pi} scenarios={principle.scenarios} />
      </Box>
    </Box>
  );
}

// ─── ScenarioFormAccordion (default export) — one instance per Zone ─

interface Props {
  mi: number;
  zi: number;
  principles: Principle[];
}

export default function ScenarioFormAccordion({ mi, zi, principles: initialPrinciples }: Props) {
  const { dispatch, draft } = useGameModelDraft();
  const principles = draft.gameMoments[mi]?.zones[zi]?.principles || initialPrinciples;
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
      emptyMessage="No hay principios. Añade el primero."
      detailTitle={(p) => `Principio: ${p.title || "Sin título"}`}
      renderListFooter={
        <Button
          size="small"
          startIcon={<AddIcon />}
          className={styles.addBtn}
          onClick={() => {
            const newIndex = principles.length;
            dispatch({ type: "ADD_PRINCIPLE", mi, zi });
            setSelectedPi(newIndex);
          }}
        >
          Añadir principio
        </Button>
      }
      renderListItem={(principle, pi) => (
        <Box className={styles.listItemContent}>
          <Typography className={styles.listItemName}>{principle.title || "Sin título"}</Typography>
          {principle.scenarios.length > 0 && (
            <Chip
              label={`${principle.scenarios.length} escenario${principle.scenarios.length !== 1 ? "s" : ""}`}
              size="small"
              className={styles.countChip}
            />
          )}
          <Tooltip title="Eliminar principio">
            <IconButton
              size="small"
              className={styles.deleteIconBtn}
              onClick={(e) => { e.stopPropagation(); dispatch({ type: "DEL_PRINCIPLE", mi, zi, pi }); }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      renderDetail={(principle, pi) => <PrincipleDetailForm mi={mi} zi={zi} pi={pi} principle={principle} />}
    />
  );
}
