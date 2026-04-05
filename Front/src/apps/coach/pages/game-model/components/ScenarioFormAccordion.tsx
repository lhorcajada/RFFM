import { useState } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Typography,
  TextField,
  Autocomplete,
  IconButton,
  Chip,
  Button,
  Tooltip,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import type { Scenario, SubPrinciple, SubSubPrinciple, TacticalPrinciple } from "../../../types/gameModel";
import { useGameModelDraft } from "../../../context/GameModelDraftContext";
import styles from "./ScenarioFormAccordion.module.css";

// ─── Sub-utils ───────────────────────────────────────────────────────

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

// ─── SubSubPrinciple Form ────────────────────────────────────────────

interface SubSubPrincipleFormProps {
  mi: number; zi: number; si: number; pi: number; qi: number;
  index: number;
  ssp: SubSubPrinciple;
}

function SubSubPrincipleForm({ mi, zi, si, pi, qi, index, ssp }: SubSubPrincipleFormProps) {
  const { dispatch } = useGameModelDraft();
  const isNew = ssp.name === "" && ssp.action === "";
  const [expanded, setExpanded] = useState(isNew);

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, v) => setExpanded(v)}
      className={styles.sspAccordion}
      disableGutters
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon className={styles.sspExpandIcon} />}
        className={styles.sspSummary}
      >
        <Box className={styles.sspSummaryContent}>
          <Typography className={styles.sspNumber}>
            Sub-subprincipio {index}
          </Typography>
          <TextField
            value={ssp.name}
            onChange={(e) => {
              e.stopPropagation();
              dispatch({ type: "UPD_SSP", mi, zi, si, pi, qi, changes: { name: e.target.value } });
            }}
            onClick={(e) => e.stopPropagation()}
            placeholder="Nombre del sub-subprincipio…"
            size="small"
            variant="standard"
            className={styles.inlineNameField}
            inputProps={{ className: styles.inlineNameInput }}
          />
          {ssp.essentialSkills.length > 0 && (
            <Chip
              label={`${ssp.essentialSkills.length} hab.`}
              size="small"
              className={styles.countChip}
            />
          )}
          <Tooltip title="Eliminar sub-subprincipio">
            <IconButton
              size="small"
              className={styles.deleteIconBtn}
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: "DEL_SSP", mi, zi, si, pi, qi });
              }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </AccordionSummary>

      <AccordionDetails className={styles.sspDetails}>
        <TextField
          value={ssp.action}
          onChange={(e) =>
            dispatch({ type: "UPD_SSP", mi, zi, si, pi, qi, changes: { action: e.target.value } })
          }
          placeholder="Acción: describe lo que hace el jugador en este momento…"
          multiline
          minRows={2}
          fullWidth
          size="small"
          className={styles.contextField}
          label="Acción"
        />

        <Box className={styles.skillsSection}>
          <Typography className={styles.sectionLabel}>
            Habilidades imprescindibles
          </Typography>
          {ssp.essentialSkills.map((sk, ki) => (
            <SkillRow
              key={sk.id}
              mi={mi} zi={zi} si={si} pi={pi} qi={qi} ki={ki}
              name={sk.name}
              description={sk.description}
            />
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
      </AccordionDetails>
    </Accordion>
  );
}

// ─── SubPrinciple Form ───────────────────────────────────────────────

interface SubPrincipleFormProps {
  mi: number; zi: number; si: number; pi: number;
  sp: SubPrinciple;
}

function SubPrincipleForm({ mi, zi, si, pi, sp }: SubPrincipleFormProps) {
  const { dispatch, availablePrinciples } = useGameModelDraft();
  const isNew = sp.name === "" && sp.context === "";
  const [expanded, setExpanded] = useState(isNew);
  const [draggingSspIdx, setDraggingSspIdx] = useState<number | null>(null);
  const [dragOverSspIdx, setDragOverSspIdx] = useState<number | null>(null);

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, v) => setExpanded(v)}
      className={styles.spAccordion}
      disableGutters
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon className={styles.spExpandIcon} />}
        className={styles.spSummary}
      >
        <Box className={styles.spSummaryContent}>
          <Typography className={styles.spLabel}>
            Subprincipio {sp.label}
          </Typography>
          <TextField
            value={sp.name}
            onChange={(e) => {
              e.stopPropagation();
              dispatch({ type: "UPD_SP", mi, zi, si, pi, changes: { name: e.target.value } });
            }}
            onClick={(e) => e.stopPropagation()}
            placeholder="Nombre del subprincipio…"
            size="small"
            variant="standard"
            className={styles.inlineNameField}
            inputProps={{ className: styles.inlineNameInput }}
          />
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
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: "DEL_SP", mi, zi, si, pi });
              }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </AccordionSummary>

      <AccordionDetails className={styles.spDetails}>
        <TextField
          value={sp.context}
          onChange={(e) =>
            dispatch({ type: "UPD_SP", mi, zi, si, pi, changes: { context: e.target.value } })
          }
          placeholder="Contexto del subprincipio: describe la situación de juego…"
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
          value={sp.tacticalPrinciples}
          onChange={(_, value) =>
            dispatch({ type: "UPD_SP", mi, zi, si, pi, changes: { tacticalPrinciples: value } })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Principios tácticos colectivos"
              size="small"
              className={styles.principlesField}
            />
          )}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => {
              const { key, ...tagProps } = getTagProps({ index });
              return (
                <Chip
                  key={key}
                  label={option.name}
                  size="small"
                  {...tagProps}
                  className={styles.principleChip}
                />
              );
            })
          }
          className={styles.principlesAutocomplete}
        />

        <Box className={styles.nestedSection}>
          <Typography className={styles.sectionLabel}>
            Sub-subprincipios
          </Typography>
          {sp.subSubPrinciples.map((ssp, qi) => (
            <Box
              key={ssp.id}
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
                onDragStart={(e: React.DragEvent) => {
                  e.dataTransfer.setData("text/plain", String(qi));
                  e.dataTransfer.effectAllowed = "move";
                  setDraggingSspIdx(qi);
                }}
                onDragEnd={() => { setDraggingSspIdx(null); setDragOverSspIdx(null); }}
              >
                <DragIndicatorIcon />
              </Box>
              <Box className={styles.dragRowContent}>
                <SubSubPrincipleForm
                  key={ssp.id}
                  mi={mi} zi={zi} si={si} pi={pi} qi={qi}
                  index={qi + 1}
                  ssp={ssp}
                />
              </Box>
            </Box>
          ))}
          <Button
            size="small"
            startIcon={<AddIcon />}
            className={styles.addBtn}
            onClick={() => dispatch({ type: "ADD_SSP", mi, zi, si, pi })}
          >
            Añadir sub-subprincipio
          </Button>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

// ─── ScenarioFormAccordion (default export) ──────────────────────────

interface Props {
  mi: number;
  zi: number;
  si: number;
  scenario: Scenario;
  defaultExpanded?: boolean;
}

export default function ScenarioFormAccordion({
  mi, zi, si, scenario, defaultExpanded = false,
}: Props) {
  const { dispatch, availablePrinciples } = useGameModelDraft();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [draggingSpIdx, setDraggingSpIdx] = useState<number | null>(null);
  const [dragOverSpIdx, setDragOverSpIdx] = useState<number | null>(null);

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, v) => setExpanded(v)}
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
          <TextField
            value={scenario.name}
            onChange={(e) => {
              e.stopPropagation();
              dispatch({ type: "UPD_SCENARIO", mi, zi, si, changes: { name: e.target.value } });
            }}
            onClick={(e) => e.stopPropagation()}
            placeholder="Nombre del escenario…"
            size="small"
            variant="standard"
            className={styles.inlineNameField}
            inputProps={{ className: styles.inlineNameInput }}
          />
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
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: "DEL_SCENARIO", mi, zi, si });
              }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </AccordionSummary>

      <AccordionDetails className={styles.details}>
        <TextField
          value={scenario.context}
          onChange={(e) =>
            dispatch({ type: "UPD_SCENARIO", mi, zi, si, changes: { context: e.target.value } })
          }
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
          onChange={(_, value) =>
            dispatch({ type: "UPD_SCENARIO", mi, zi, si, changes: { tacticalPrinciples: value } })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Principios tácticos colectivos"
              size="small"
              className={styles.principlesField}
            />
          )}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => {
              const { key, ...tagProps } = getTagProps({ index });
              return (
                <Chip
                  key={key}
                  label={option.name}
                  size="small"
                  {...tagProps}
                  className={styles.principleChip}
                />
              );
            })
          }
          className={styles.principlesAutocomplete}
        />

        <Box className={styles.nestedSection}>
          <Typography className={styles.sectionLabel}>
            Subprincipios
          </Typography>
          {scenario.subPrinciples.map((sp, pi) => (
            <Box
              key={sp.id}
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
                onDragStart={(e: React.DragEvent) => {
                  e.dataTransfer.setData("text/plain", String(pi));
                  e.dataTransfer.effectAllowed = "move";
                  setDraggingSpIdx(pi);
                }}
                onDragEnd={() => { setDraggingSpIdx(null); setDragOverSpIdx(null); }}
              >
                <DragIndicatorIcon />
              </Box>
              <Box className={styles.dragRowContent}>
                <SubPrincipleForm
                  key={sp.id}
                  mi={mi} zi={zi} si={si} pi={pi}
                  sp={sp}
                />
              </Box>
            </Box>
          ))}
          <Button
            size="small"
            startIcon={<AddIcon />}
            className={styles.addBtn}
            onClick={() => dispatch({ type: "ADD_SP", mi, zi, si })}
          >
            Añadir subprincipio
          </Button>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
