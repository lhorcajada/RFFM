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
import type {
  AdnOptions,
  AdnSubprincipioOption,
  AdnSubSubPrincipioOption,
  GameZoneCatalogItem,
  Macrociclo,
  Mesociclo,
  Microciclo,
  SeasonPlan,
} from "../../../types/seasonPlan";
import { HABILIDAD_VOCABULARY } from "../../../types/gameModel";
import styles from "./SeasonPlanEditor.module.css";

let _draftKeyCounter = -1;
const nextDraftKey = () => _draftKeyCounter--;

const EMPTY_MICROCICLO = (order: number): Microciclo => ({
  id: nextDraftKey(),
  order,
  weekLabel: "",
  startDate: "",
  endDate: "",
  objetivoSesionA: "",
  objetivoSesionB: "",
  exerciseCount: 0,
  sesionASubprincipioIds: [],
  sesionASubSubPrincipioIds: [],
  sesionAHabilidades: [],
  sesionASubprincipios: [],
  sesionASubSubPrincipios: [],
  sesionBSubprincipioIds: [],
  sesionBSubSubPrincipioIds: [],
  sesionBHabilidades: [],
  sesionBSubprincipios: [],
  sesionBSubSubPrincipios: [],
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

interface SessionAdnPickersProps {
  sessionLabel: "A" | "B";
  subprincipioIds: string[];
  subSubPrincipioIds: string[];
  habilidades: string[];
  adnOptions: AdnOptions;
  hasGameModel: boolean;
  onChangeSubprincipioIds: (ids: string[]) => void;
  onChangeSubSubPrincipioIds: (ids: string[]) => void;
  onChangeHabilidades: (habilidades: string[]) => void;
}

/** Subprincipio/SubSubPrincipio/Habilidad multi-selects for one Microciclo session (A or B).
 * Subprincipio/SubSubPrincipio stay disabled (not hidden) when the team has no GameModel yet
 * for this season — Habilidad selection is always usable (fixed 15-value vocabulary). */
function SessionAdnPickers({
  sessionLabel,
  subprincipioIds,
  subSubPrincipioIds,
  habilidades,
  adnOptions,
  hasGameModel,
  onChangeSubprincipioIds,
  onChangeSubSubPrincipioIds,
  onChangeHabilidades,
}: SessionAdnPickersProps) {
  const availableSubSubPrincipios =
    subprincipioIds.length > 0
      ? adnOptions.subSubPrincipios.filter((s) => subprincipioIds.includes(s.subprincipioId))
      : adnOptions.subSubPrincipios;

  return (
    <Box className={styles.adnPickersRow}>
      <Autocomplete<AdnSubprincipioOption, true>
        multiple
        size="small"
        disabled={!hasGameModel}
        options={adnOptions.subprincipios}
        value={adnOptions.subprincipios.filter((o) => subprincipioIds.includes(o.id))}
        getOptionLabel={(o) => `${o.numero} · ${o.titulo}`}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        onChange={(_, value) => onChangeSubprincipioIds(value.map((v) => v.id))}
        renderInput={(params) => <TextField {...params} label={`Subprincipio — Sesión ${sessionLabel}`} />}
        className={styles.adnPicker}
      />
      <Autocomplete<AdnSubSubPrincipioOption, true>
        multiple
        size="small"
        disabled={!hasGameModel}
        options={availableSubSubPrincipios}
        value={adnOptions.subSubPrincipios.filter((o) => subSubPrincipioIds.includes(o.id))}
        getOptionLabel={(o) => `${o.numero} · ${o.rol}`}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        onChange={(_, value) => onChangeSubSubPrincipioIds(value.map((v) => v.id))}
        renderInput={(params) => <TextField {...params} label={`SubSubPrincipio — Sesión ${sessionLabel}`} />}
        className={styles.adnPicker}
      />
      <Autocomplete<string, true>
        multiple
        size="small"
        options={HABILIDAD_VOCABULARY as unknown as string[]}
        value={habilidades}
        onChange={(_, value) => onChangeHabilidades(value)}
        renderInput={(params) => <TextField {...params} label={`Habilidad — Sesión ${sessionLabel}`} />}
        className={styles.adnPicker}
      />
    </Box>
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
          Añade primero el Modelo ADN del equipo para poder enlazar subprincipios.
        </Typography>
      )}

      <TextField
        value={microciclo.objetivoSesionA}
        onChange={(e) => onUpdate({ objetivoSesionA: e.target.value })}
        label="Objetivo sesión A (Defensa organizada + Transición defensa-ataque)"
        multiline
        minRows={2}
        fullWidth
        size="small"
      />
      <SessionAdnPickers
        sessionLabel="A"
        subprincipioIds={microciclo.sesionASubprincipioIds}
        subSubPrincipioIds={microciclo.sesionASubSubPrincipioIds}
        habilidades={microciclo.sesionAHabilidades}
        adnOptions={adnOptions}
        hasGameModel={hasGameModel}
        onChangeSubprincipioIds={(ids) => onUpdate({ sesionASubprincipioIds: ids })}
        onChangeSubSubPrincipioIds={(ids) => onUpdate({ sesionASubSubPrincipioIds: ids })}
        onChangeHabilidades={(habilidades) => onUpdate({ sesionAHabilidades: habilidades })}
      />

      <TextField
        value={microciclo.objetivoSesionB}
        onChange={(e) => onUpdate({ objetivoSesionB: e.target.value })}
        label="Objetivo sesión B (Ataque organizado + Transición ataque-defensa)"
        multiline
        minRows={2}
        fullWidth
        size="small"
      />
      <SessionAdnPickers
        sessionLabel="B"
        subprincipioIds={microciclo.sesionBSubprincipioIds}
        subSubPrincipioIds={microciclo.sesionBSubSubPrincipioIds}
        habilidades={microciclo.sesionBHabilidades}
        adnOptions={adnOptions}
        hasGameModel={hasGameModel}
        onChangeSubprincipioIds={(ids) => onUpdate({ sesionBSubprincipioIds: ids })}
        onChangeSubSubPrincipioIds={(ids) => onUpdate({ sesionBSubSubPrincipioIds: ids })}
        onChangeHabilidades={(habilidades) => onUpdate({ sesionBHabilidades: habilidades })}
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
