import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { SubSubPrincipio, Subprincipio, Zona } from "../../../types/gameModel";
import { SET_PIECE_SUBTYPE_LABELS, SET_PIECE_SUBTYPES, ZONE_KEY_OPTIONS } from "../../../types/gameModel";
import type { GameMomentCatalogItem } from "../../../types/gameModel";
import { useGameModelDraft } from "../../../context/GameModelDraftContext";
import NotaListEditor from "./NotaListEditor";
import HabilidadListEditor from "./HabilidadListEditor";
import { indexedSortByNumero } from "./gameModelOrder";
import styles from "./GameModelFormEditor.module.css";

// ─── SubSubPrincipio editor (hangs off a Zona [zi set] or a Subprincipio [zi undefined]) ──

interface SspProps {
  pi: number;
  spi: number;
  zi?: number;
  sspi: number;
  ssp: SubSubPrincipio;
}

function SubSubPrincipioEditor({ pi, spi, zi, sspi, ssp }: SspProps) {
  const { dispatch } = useGameModelDraft();
  return (
    <Accordion className={styles.accordion} defaultExpanded={false} TransitionProps={{ unmountOnExit: true }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography className={styles.sspSummaryTitle}>
          Sub-subprincipio {ssp.numero || sspi + 1}
          {ssp.rol && ` — ${ssp.rol}`}
        </Typography>
      </AccordionSummary>
      <AccordionDetails className={styles.details}>
        <Box className={styles.fieldsRow}>
          <TextField
            value={ssp.numero}
            onChange={(e) => dispatch({ type: "UPD_SSP", pi, spi, zi, sspi, changes: { numero: e.target.value } })}
            label="Numero"
            size="small"
            className={styles.numeroField}
          />
          <TextField
            value={ssp.rol}
            onChange={(e) => dispatch({ type: "UPD_SSP", pi, spi, zi, sspi, changes: { rol: e.target.value } })}
            label="Rol"
            size="small"
            fullWidth
          />
        </Box>
        <TextField
          value={ssp.texto}
          onChange={(e) => dispatch({ type: "UPD_SSP", pi, spi, zi, sspi, changes: { texto: e.target.value } })}
          label="Texto"
          multiline
          minRows={2}
          fullWidth
          size="small"
        />

        <HabilidadListEditor
          habilidades={ssp.habilidades}
          onAdd={() => dispatch({ type: "ADD_HABILIDAD", pi, spi, zi, sspi })}
          onUpdate={(hi, changes) => dispatch({ type: "UPD_HABILIDAD", pi, spi, zi, sspi, hi, changes })}
          onDelete={(hi) => dispatch({ type: "DEL_HABILIDAD", pi, spi, zi, sspi, hi })}
        />

        <NotaListEditor
          notas={ssp.notas}
          onAdd={() => dispatch({ type: "ADD_NOTA", level: "ssp", pi, spi, zi, sspi })}
          onUpdate={(ni, changes) => dispatch({ type: "UPD_NOTA", level: "ssp", pi, spi, zi, sspi, ni, changes })}
          onDelete={(ni) => dispatch({ type: "DEL_NOTA", level: "ssp", pi, spi, zi, sspi, ni })}
        />

        <Button
          size="small"
          color="error"
          startIcon={<DeleteOutlineIcon />}
          onClick={() => dispatch({ type: "DEL_SSP", pi, spi, zi, sspi })}
          className={styles.deleteBtn}
        >
          Eliminar sub-subprincipio
        </Button>
      </AccordionDetails>
    </Accordion>
  );
}

// ─── Zona editor ──────────────────────────────────────────────────────

interface ZonaProps {
  pi: number;
  spi: number;
  zi: number;
  zona: Zona;
}

function ZonaEditor({ pi, spi, zi, zona }: ZonaProps) {
  const { dispatch } = useGameModelDraft();
  const isCompuesta = zona.zoneKeys.includes("compuesta");

  return (
    <Accordion className={styles.accordion} TransitionProps={{ unmountOnExit: true }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography className={styles.zonaSummaryTitle}>
          {zona.label || zona.zoneKeys.join(", ") || "Zona sin definir"}
        </Typography>
      </AccordionSummary>
      <AccordionDetails className={styles.details}>
        <Select
          multiple
          value={zona.zoneKeys}
          onChange={(e) => {
            const value = e.target.value as string[];
            dispatch({ type: "UPD_ZONA", pi, spi, zi, changes: { zoneKeys: value } });
          }}
          size="small"
          fullWidth
          displayEmpty
          renderValue={(selected) => (selected as string[]).join(", ") || "Selecciona zona…"}
          data-testid={`zona-keys-select-${pi}-${spi}-${zi}`}
        >
          {ZONE_KEY_OPTIONS.map((opt) => (
            <MenuItem key={opt.key} value={opt.key}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>

        <TextField
          value={zona.label ?? ""}
          onChange={(e) => dispatch({ type: "UPD_ZONA", pi, spi, zi, changes: { label: e.target.value || null } })}
          label="Etiqueta (sub-agrupación opcional)"
          size="small"
          fullWidth
        />

        {isCompuesta && (
          <TextField
            value={zona.zonaTexto ?? ""}
            onChange={(e) => dispatch({ type: "UPD_ZONA", pi, spi, zi, changes: { zonaTexto: e.target.value } })}
            label="Texto literal de la zona compuesta"
            size="small"
            fullWidth
            multiline
          />
        )}

        <TextField
          value={zona.texto}
          onChange={(e) => dispatch({ type: "UPD_ZONA", pi, spi, zi, changes: { texto: e.target.value } })}
          label="Texto"
          multiline
          minRows={2}
          fullWidth
          size="small"
        />

        <Box className={styles.nestedSection}>
          <Typography className={styles.sectionLabel}>Sub-subprincipios</Typography>
          {indexedSortByNumero(zona.subSubPrincipios).map(({ item: ssp, index: sspi }) => (
            <SubSubPrincipioEditor key={ssp.id} pi={pi} spi={spi} zi={zi} sspi={sspi} ssp={ssp} />
          ))}
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => dispatch({ type: "ADD_SSP", pi, spi, zi })}
            className={styles.addBtn}
          >
            Añadir sub-subprincipio
          </Button>
        </Box>

        <NotaListEditor
          notas={zona.notas}
          onAdd={() => dispatch({ type: "ADD_NOTA", level: "zona", pi, spi, zi })}
          onUpdate={(ni, changes) => dispatch({ type: "UPD_NOTA", level: "zona", pi, spi, zi, ni, changes })}
          onDelete={(ni) => dispatch({ type: "DEL_NOTA", level: "zona", pi, spi, zi, ni })}
        />

        <Button
          size="small"
          color="error"
          startIcon={<DeleteOutlineIcon />}
          onClick={() => dispatch({ type: "DEL_ZONA", pi, spi, zi })}
          className={styles.deleteBtn}
        >
          Eliminar zona
        </Button>
      </AccordionDetails>
    </Accordion>
  );
}

// ─── Subprincipio editor ──────────────────────────────────────────────

interface SubprincipioProps {
  pi: number;
  spi: number;
  sp: Subprincipio;
}

function SubprincipioEditor({ pi, spi, sp }: SubprincipioProps) {
  const { dispatch } = useGameModelDraft();
  const hasZonas = sp.zonas.length > 0;
  const hasDirectSsp = sp.subSubPrincipios.length > 0;

  return (
    <Accordion className={styles.accordion} TransitionProps={{ unmountOnExit: true }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography className={styles.subprincipioSummaryTitle}>
          Subprincipio {sp.numero || spi + 1} — {sp.titulo || "Sin título"}
        </Typography>
      </AccordionSummary>
      <AccordionDetails className={styles.details}>
        <Box className={styles.fieldsRow}>
          <TextField
            value={sp.numero}
            onChange={(e) => dispatch({ type: "UPD_SUBPRINCIPIO", pi, spi, changes: { numero: e.target.value } })}
            label="Numero"
            size="small"
            className={styles.numeroField}
          />
          <TextField
            value={sp.titulo}
            onChange={(e) => dispatch({ type: "UPD_SUBPRINCIPIO", pi, spi, changes: { titulo: e.target.value } })}
            label="Título"
            size="small"
            fullWidth
          />
        </Box>
        <TextField
          value={sp.texto}
          onChange={(e) => dispatch({ type: "UPD_SUBPRINCIPIO", pi, spi, changes: { texto: e.target.value } })}
          label="Texto"
          multiline
          minRows={2}
          fullWidth
          size="small"
        />

        <Box className={styles.nestedSection}>
          <Typography className={styles.sectionLabel}>
            Zonas (opcional — un Subprincipio cuelga sus sub-subprincipios de sus Zonas, o directamente de él, nunca ambos)
          </Typography>
          {sp.zonas.map((zona, zi) => (
            // Zonas have no `numero` in the ADN spec (they're identified by zoneKeys/label,
            // not a document position) — rendered in draft order, unlike Subprincipios/SSPs.
            <ZonaEditor key={zona.id} pi={pi} spi={spi} zi={zi} zona={zona} />
          ))}
          {!hasDirectSsp && (
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => dispatch({ type: "ADD_ZONA", pi, spi })}
              className={styles.addBtn}
            >
              Añadir zona
            </Button>
          )}
        </Box>

        {!hasZonas && (
          <Box className={styles.nestedSection}>
            <Typography className={styles.sectionLabel}>Sub-subprincipios directos</Typography>
            {indexedSortByNumero(sp.subSubPrincipios).map(({ item: ssp, index: sspi }) => (
              <SubSubPrincipioEditor key={ssp.id} pi={pi} spi={spi} sspi={sspi} ssp={ssp} />
            ))}
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => dispatch({ type: "ADD_SSP", pi, spi })}
              className={styles.addBtn}
            >
              Añadir sub-subprincipio directo
            </Button>
          </Box>
        )}

        <NotaListEditor
          notas={sp.notas}
          onAdd={() => dispatch({ type: "ADD_NOTA", level: "subprincipio", pi, spi })}
          onUpdate={(ni, changes) => dispatch({ type: "UPD_NOTA", level: "subprincipio", pi, spi, ni, changes })}
          onDelete={(ni) => dispatch({ type: "DEL_NOTA", level: "subprincipio", pi, spi, ni })}
        />

        <Button
          size="small"
          color="error"
          startIcon={<DeleteOutlineIcon />}
          onClick={() => dispatch({ type: "DEL_SUBPRINCIPIO", pi, spi })}
          className={styles.deleteBtn}
        >
          Eliminar subprincipio
        </Button>
      </AccordionDetails>
    </Accordion>
  );
}

// ─── Principle editor ─────────────────────────────────────────────────

interface PrincipleProps {
  pi: number;
}

function PrincipleEditor({ pi }: PrincipleProps) {
  const { draft, dispatch } = useGameModelDraft();
  const principle = draft.principles[pi];
  if (!principle) return null;

  return (
    <Accordion className={styles.accordion} TransitionProps={{ unmountOnExit: true }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography className={styles.principleSummaryTitle}>
          {principle.numero || pi + 1}. {principle.titulo || "Sin título"}
        </Typography>
        {principle.subprincipios.length > 0 && (
          <Chip label={`${principle.subprincipios.length} subprincipios`} size="small" className={styles.countChip} />
        )}
      </AccordionSummary>
      <AccordionDetails className={styles.details}>
        <Box className={styles.fieldsRow}>
          <TextField
            value={principle.numero}
            onChange={(e) =>
              dispatch({ type: "UPD_PRINCIPLE", pi, changes: { numero: Number(e.target.value) || 0 } })
            }
            label="Numero"
            size="small"
            type="number"
            className={styles.numeroField}
          />
          <TextField
            value={principle.titulo}
            onChange={(e) => dispatch({ type: "UPD_PRINCIPLE", pi, changes: { titulo: e.target.value } })}
            label="Título"
            size="small"
            fullWidth
          />
        </Box>
        <TextField
          value={principle.texto}
          onChange={(e) => dispatch({ type: "UPD_PRINCIPLE", pi, changes: { texto: e.target.value } })}
          label="Texto"
          multiline
          minRows={2}
          fullWidth
          size="small"
        />

        <Box className={styles.nestedSection}>
          <Typography className={styles.sectionLabel}>Subprincipios</Typography>
          {indexedSortByNumero(principle.subprincipios).map(({ item: sp, index: spi }) => (
            <SubprincipioEditor key={sp.id} pi={pi} spi={spi} sp={sp} />
          ))}
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => dispatch({ type: "ADD_SUBPRINCIPIO", pi })}
            className={styles.addBtn}
          >
            Añadir subprincipio
          </Button>
        </Box>

        <NotaListEditor
          notas={principle.notas}
          onAdd={() => dispatch({ type: "ADD_NOTA", level: "principle", pi })}
          onUpdate={(ni, changes) => dispatch({ type: "UPD_NOTA", level: "principle", pi, ni, changes })}
          onDelete={(ni) => dispatch({ type: "DEL_NOTA", level: "principle", pi, ni })}
        />

        <Button
          size="small"
          color="error"
          startIcon={<DeleteOutlineIcon />}
          onClick={() => dispatch({ type: "DEL_PRINCIPLE", pi })}
          className={styles.deleteBtn}
        >
          Eliminar principio
        </Button>
      </AccordionDetails>
    </Accordion>
  );
}

// ─── Moment section (groups principles by Fase) ──────────────────────

function MomentSection({ moment }: { moment: GameMomentCatalogItem }) {
  const { draft, dispatch } = useGameModelDraft();
  const principleIndices = draft.principles
    .map((p, pi) => ({ p, pi }))
    .filter(({ p }) => p.gameMomentId === moment.id);

  return (
    <Box className={styles.momentSection}>
      <Typography component="h3" className={styles.momentTitle}>
        {moment.name}
      </Typography>
      {principleIndices.map(({ pi }) => (
        <PrincipleEditor key={draft.principles[pi].id} pi={pi} />
      ))}
      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={() => dispatch({ type: "ADD_PRINCIPLE", gameMomentId: moment.id })}
        className={styles.addBtn}
      >
        Añadir principio
      </Button>
    </Box>
  );
}

// ─── SetPieceRule flat section ────────────────────────────────────────

function SetPieceRulesSection() {
  const { draft, dispatch } = useGameModelDraft();
  return (
    <Box className={styles.momentSection}>
      <Typography component="h3" className={styles.momentTitle}>
        Balón Parado
      </Typography>
      {draft.setPieceRules.map((rule, i) => (
        <Box key={rule.id} className={styles.flatRow}>
          <Select
            value={rule.subtype}
            onChange={(e) => dispatch({ type: "UPD_SET_PIECE_RULE", i, changes: { subtype: e.target.value } })}
            size="small"
            displayEmpty
            className={styles.numeroField}
          >
            <MenuItem value="" disabled>
              Subtipo…
            </MenuItem>
            {SET_PIECE_SUBTYPES.map((s) => (
              <MenuItem key={s} value={s}>
                {SET_PIECE_SUBTYPE_LABELS[s]}
              </MenuItem>
            ))}
          </Select>
          <TextField
            value={rule.texto}
            onChange={(e) => dispatch({ type: "UPD_SET_PIECE_RULE", i, changes: { texto: e.target.value } })}
            label="Texto"
            size="small"
            fullWidth
            multiline
            maxRows={4}
          />
          <Tooltip title="Eliminar regla">
            <IconButton size="small" onClick={() => dispatch({ type: "DEL_SET_PIECE_RULE", i })}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ))}
      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={() => dispatch({ type: "ADD_SET_PIECE_RULE" })}
        className={styles.addBtn}
      >
        Añadir regla de balón parado
      </Button>
    </Box>
  );
}

// ─── OpenIssue flat section ────────────────────────────────────────────

function OpenIssuesSection() {
  const { draft, dispatch } = useGameModelDraft();
  return (
    <Box className={styles.momentSection}>
      <Typography component="h3" className={styles.momentTitle}>
        Pendientes abiertos
      </Typography>
      {draft.openIssues.map((issue, i) => (
        <Box key={issue.id} className={styles.flatRow} sx={{ flexDirection: "column", alignItems: "stretch" }}>
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              value={issue.topic}
              onChange={(e) => dispatch({ type: "UPD_OPEN_ISSUE", i, changes: { topic: e.target.value } })}
              label="Tema"
              size="small"
              fullWidth
            />
            <Select
              value={issue.status}
              onChange={(e) => dispatch({ type: "UPD_OPEN_ISSUE", i, changes: { status: e.target.value } })}
              size="small"
              className={styles.numeroField}
            >
              <MenuItem value="open">Pendiente</MenuItem>
              <MenuItem value="resolved">Resuelto</MenuItem>
            </Select>
            <Tooltip title="Eliminar pendiente">
              <IconButton size="small" onClick={() => dispatch({ type: "DEL_OPEN_ISSUE", i })}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <TextField
            value={issue.description}
            onChange={(e) => dispatch({ type: "UPD_OPEN_ISSUE", i, changes: { description: e.target.value } })}
            label="Descripción"
            size="small"
            fullWidth
            multiline
            maxRows={4}
            sx={{ mt: 1 }}
          />
        </Box>
      ))}
      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={() => dispatch({ type: "ADD_OPEN_ISSUE" })}
        className={styles.addBtn}
      >
        Añadir pendiente
      </Button>
    </Box>
  );
}

// ─── Root editor ───────────────────────────────────────────────────────

interface Props {
  moments: GameMomentCatalogItem[];
}

export default function GameModelFormEditor({ moments }: Props) {
  const { draft, dispatch } = useGameModelDraft();
  const setPieceMoment = moments.find((m) => m.name.toLowerCase().includes("balón parado") || m.name.toLowerCase().includes("balon parado"));
  const treeMoments = moments.filter((m) => m.id !== setPieceMoment?.id);

  return (
    <Box className={styles.root}>
      <TextField
        value={draft.name}
        onChange={(e) => dispatch({ type: "SET_NAME", value: e.target.value })}
        label="Nombre del modelo"
        size="small"
        className={styles.nameField}
        fullWidth
      />

      {treeMoments.map((m) => (
        <MomentSection key={m.id} moment={m} />
      ))}

      <SetPieceRulesSection />
      <OpenIssuesSection />
    </Box>
  );
}
