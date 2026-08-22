import { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Select,
  TextField,
  Typography,
  type SelectChangeEvent,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Link as RouterLink } from "react-router-dom";
import type {
  AdnOptions,
  AdnSubprincipioOption,
  GameZoneCatalogItem,
  Macrociclo,
  Mesociclo,
  Microciclo,
  SeasonPlan,
} from "../../../types/seasonPlan";
import styles from "./SeasonPlanEditor.module.css";

let _draftKeyCounter = -1;
const nextDraftKey = () => _draftKeyCounter--;

const EMPTY_MICROCICLO = (order: number): Microciclo => ({
  id: nextDraftKey(),
  order,
  weekLabel: "",
  startDate: "",
  endDate: "",
  sessions: [],
  subprincipiosObjetivo: [],
  subprincipioObjetivoIds: [],
});

const EMPTY_MESOCICLO = (order: number): Mesociclo => ({
  id: nextDraftKey(),
  order,
  name: "",
  startDate: "",
  endDate: "",
  gameZoneId: 0,
  microciclos: [],
});

const EMPTY_MACROCICLO = (order: number): Macrociclo => ({
  id: nextDraftKey(),
  order,
  name: "",
  startDate: "",
  endDate: "",
  mesociclos: [],
});

interface MicrocicloSubprincipioObjetivoPickerProps {
  subprincipioObjetivoIds: string[];
  adnOptions: AdnOptions;
  hasGameModel: boolean;
  onChange: (ids: string[]) => void;
}

/** Multi-select of target Subprincipios for a Microciclo — reference-only, no FOCO/INTEGRADO,
 * no Habilidades, no SubSubPrincipio (those stay exercise-only, see
 * openspec/changes/season-plan-target-subprincipios). */
function MicrocicloSubprincipioObjetivoPicker({
  subprincipioObjetivoIds,
  adnOptions,
  hasGameModel,
  onChange,
}: MicrocicloSubprincipioObjetivoPickerProps) {
  return (
    <Autocomplete<AdnSubprincipioOption, true>
      multiple
      size="small"
      disabled={!hasGameModel}
      options={adnOptions.subprincipios}
      value={adnOptions.subprincipios.filter((o) => subprincipioObjetivoIds.includes(o.id))}
      getOptionLabel={(o) => `${o.numero} · ${o.titulo}`}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      onChange={(_, value) => onChange(value.map((v) => v.id))}
      renderInput={(params) => <TextField {...params} label="Subprincipios objetivo de la semana" />}
      className={styles.subprincipioObjetivoPicker}
    />
  );
}

interface MicrocicloEditorProps {
  microciclo: Microciclo;
  adnOptions: AdnOptions;
  onUpdate: (changes: Partial<Microciclo>) => void;
  onDelete: () => void;
}

function MicrocicloEditor({ microciclo, adnOptions, onUpdate, onDelete }: MicrocicloEditorProps) {
  const hasGameModel = adnOptions.subprincipios.length > 0;

  return (
    <Box className={styles.microcicloCard}>
      <Box className={styles.fieldsRow}>
        <TextField
          value={microciclo.weekLabel}
          onChange={(e) => onUpdate({ weekLabel: e.target.value })}
          label="Semana"
          size="small"
          fullWidth
        />
        <TextField
          value={microciclo.startDate}
          onChange={(e) => onUpdate({ startDate: e.target.value })}
          label="Inicio"
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          value={microciclo.endDate}
          onChange={(e) => onUpdate({ endDate: e.target.value })}
          label="Fin"
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
        />
      </Box>

      {!hasGameModel && (
        <Typography className={styles.noGameModelHint}>
          Añade primero el{" "}
          <RouterLink to="/coach/game-model" className={styles.noGameModelLink}>
            Modelo ADN
          </RouterLink>{" "}
          del equipo para poder elegir Subprincipios objetivo.
        </Typography>
      )}
      <MicrocicloSubprincipioObjetivoPicker
        subprincipioObjetivoIds={microciclo.subprincipioObjetivoIds}
        adnOptions={adnOptions}
        hasGameModel={hasGameModel}
        onChange={(ids) => onUpdate({ subprincipioObjetivoIds: ids })}
      />

      <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={onDelete} className={styles.deleteBtn}>
        Eliminar microciclo
      </Button>
    </Box>
  );
}

interface MesocicloEditorProps {
  mesociclo: Mesociclo;
  zones: GameZoneCatalogItem[];
  adnOptions: AdnOptions;
  onUpdate: (changes: Partial<Mesociclo>) => void;
  onDelete: () => void;
}

function MesocicloEditor({ mesociclo, zones, adnOptions, onUpdate, onDelete }: MesocicloEditorProps) {
  const updateMicrociclo = (mi: number, changes: Partial<Microciclo>) => {
    const microciclos = mesociclo.microciclos.map((m, i) => (i === mi ? { ...m, ...changes } : m));
    onUpdate({ microciclos });
  };

  const deleteMicrociclo = (mi: number) => {
    onUpdate({ microciclos: mesociclo.microciclos.filter((_, i) => i !== mi) });
  };

  const addMicrociclo = () => {
    onUpdate({ microciclos: [...mesociclo.microciclos, EMPTY_MICROCICLO(mesociclo.microciclos.length + 1)] });
  };

  return (
    <Accordion className={styles.accordion} TransitionProps={{ unmountOnExit: true }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography className={styles.mesocicloSummary}>{mesociclo.name || "Mesociclo sin nombre"}</Typography>
      </AccordionSummary>
      <AccordionDetails className={styles.details}>
        <Box className={styles.fieldsRow}>
          <TextField
            value={mesociclo.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            label="Nombre del mesociclo"
            size="small"
            fullWidth
          />
          <Select
            value={mesociclo.gameZoneId || ""}
            onChange={(e: SelectChangeEvent<number | string>) => onUpdate({ gameZoneId: Number(e.target.value) })}
            size="small"
            displayEmpty
            className={styles.zoneSelect}
          >
            <MenuItem value="" disabled>
              Zona…
            </MenuItem>
            {zones.map((z) => (
              <MenuItem key={z.id} value={z.id}>
                {z.name}
              </MenuItem>
            ))}
          </Select>
        </Box>
        <Box className={styles.fieldsRow}>
          <TextField
            value={mesociclo.startDate}
            onChange={(e) => onUpdate({ startDate: e.target.value })}
            label="Inicio"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            value={mesociclo.endDate}
            onChange={(e) => onUpdate({ endDate: e.target.value })}
            label="Fin"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        </Box>

        <Box className={styles.nestedSection}>
          <Typography className={styles.sectionLabel}>Microciclos</Typography>
          {mesociclo.microciclos.map((microciclo, mi) => (
            <MicrocicloEditor
              key={microciclo.id}
              microciclo={microciclo}
              adnOptions={adnOptions}
              onUpdate={(changes) => updateMicrociclo(mi, changes)}
              onDelete={() => deleteMicrociclo(mi)}
            />
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addMicrociclo} className={styles.addBtn}>
            Añadir microciclo
          </Button>
        </Box>

        <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={onDelete} className={styles.deleteBtn}>
          Eliminar mesociclo
        </Button>
      </AccordionDetails>
    </Accordion>
  );
}

interface MacrocicloEditorProps {
  macrociclo: Macrociclo;
  zones: GameZoneCatalogItem[];
  adnOptions: AdnOptions;
  onUpdate: (changes: Partial<Macrociclo>) => void;
  onDelete: () => void;
}

function MacrocicloEditor({ macrociclo, zones, adnOptions, onUpdate, onDelete }: MacrocicloEditorProps) {
  const updateMesociclo = (mi: number, changes: Partial<Mesociclo>) => {
    const mesociclos = macrociclo.mesociclos.map((m, i) => (i === mi ? { ...m, ...changes } : m));
    onUpdate({ mesociclos });
  };

  const deleteMesociclo = (mi: number) => {
    onUpdate({ mesociclos: macrociclo.mesociclos.filter((_, i) => i !== mi) });
  };

  const addMesociclo = () => {
    onUpdate({ mesociclos: [...macrociclo.mesociclos, EMPTY_MESOCICLO(macrociclo.mesociclos.length + 1)] });
  };

  return (
    <Accordion className={styles.accordion} defaultExpanded TransitionProps={{ unmountOnExit: true }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography className={styles.macrocicloSummary}>{macrociclo.name || "Macrociclo sin nombre"}</Typography>
      </AccordionSummary>
      <AccordionDetails className={styles.details}>
        <Box className={styles.fieldsRow}>
          <TextField
            value={macrociclo.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            label="Nombre del macrociclo"
            size="small"
            fullWidth
          />
          <TextField
            value={macrociclo.startDate}
            onChange={(e) => onUpdate({ startDate: e.target.value })}
            label="Inicio"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            value={macrociclo.endDate}
            onChange={(e) => onUpdate({ endDate: e.target.value })}
            label="Fin"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        </Box>

        <Box className={styles.nestedSection}>
          <Typography className={styles.sectionLabel}>Mesociclos</Typography>
          {macrociclo.mesociclos.map((mesociclo, mi) => (
            <MesocicloEditor
              key={mesociclo.id}
              mesociclo={mesociclo}
              zones={zones}
              adnOptions={adnOptions}
              onUpdate={(changes) => updateMesociclo(mi, changes)}
              onDelete={() => deleteMesociclo(mi)}
            />
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addMesociclo} className={styles.addBtn}>
            Añadir mesociclo
          </Button>
        </Box>

        <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={onDelete} className={styles.deleteBtn}>
          Eliminar macrociclo
        </Button>
      </AccordionDetails>
    </Accordion>
  );
}

interface SeasonPlanEditorProps {
  draft: SeasonPlan;
  zones: GameZoneCatalogItem[];
  adnOptions: AdnOptions;
  saving: boolean;
  onSave: (draft: SeasonPlan) => void;
  onCancel: () => void;
}

export default function SeasonPlanEditor({ draft: initialDraft, zones, adnOptions, saving, onSave, onCancel }: SeasonPlanEditorProps) {
  const [draft, setDraft] = useState<SeasonPlan>(initialDraft);

  const updateMacrociclo = (mi: number, changes: Partial<Macrociclo>) => {
    setDraft((prev) => ({
      ...prev,
      macrociclos: prev.macrociclos.map((m, i) => (i === mi ? { ...m, ...changes } : m)),
    }));
  };

  const deleteMacrociclo = (mi: number) => {
    setDraft((prev) => ({ ...prev, macrociclos: prev.macrociclos.filter((_, i) => i !== mi) }));
  };

  const addMacrociclo = () => {
    setDraft((prev) => ({ ...prev, macrociclos: [...prev.macrociclos, EMPTY_MACROCICLO(prev.macrociclos.length + 1)] }));
  };

  return (
    <Box className={styles.root}>
      {draft.macrociclos.map((macrociclo, mi) => (
        <MacrocicloEditor
          key={macrociclo.id}
          macrociclo={macrociclo}
          zones={zones}
          adnOptions={adnOptions}
          onUpdate={(changes) => updateMacrociclo(mi, changes)}
          onDelete={() => deleteMacrociclo(mi)}
        />
      ))}

      <Button startIcon={<AddIcon />} onClick={addMacrociclo} className={styles.addBtn}>
        Añadir macrociclo
      </Button>

      <Box className={styles.actionsRow}>
        <Button onClick={onCancel} variant="outlined" size="small" disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={() => onSave(draft)} variant="contained" size="small" disabled={saving}>
          {saving ? <CircularProgress size={16} /> : "Guardar"}
        </Button>
      </Box>
    </Box>
  );
}
