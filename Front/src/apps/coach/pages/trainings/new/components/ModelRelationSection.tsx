import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Box, Checkbox, Chip, IconButton, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Link as RouterLink } from "react-router-dom";
import gameModelService from "../../../../services/gameModelService";
import seasonService from "../../../../services/seasonService";
import { compareNumero, zonaHeading } from "../../../game-model/components/gameModelOrder";
import type { GameModel, Principle, Subprincipio, SubSubPrincipio } from "../../../../types/gameModel";
import type { ExerciseModelRelationRequest } from "../../../../types/training";
import {
  findSelectedItem,
  setSubSubPrincipioFoco,
  toggleSubSubPrincipio,
  toggleSubSubPrincipioHabilidad,
} from "./modelRelationSelection";
import styles from "./ModelRelationSection.module.css";

function useTeamGameModel(teamId?: string): { gameModel: GameModel | null; loaded: boolean } {
  const [state, setState] = useState<{ gameModel: GameModel | null; loaded: boolean }>({ gameModel: null, loaded: false });

  useEffect(() => {
    if (!teamId) {
      setState({ gameModel: null, loaded: true });
      return;
    }
    let cancelled = false;

    async function load() {
      const activeSeason = await seasonService.getActiveSeason();
      const seasonLabel = activeSeason?.name ?? activeSeason?.id;
      const gameModel = seasonLabel ? await gameModelService.getByTeamIdAndSeason(teamId as string, seasonLabel) : null;
      if (!cancelled) setState({ gameModel, loaded: true });
    }

    void load().catch(() => {
      if (!cancelled) setState({ gameModel: null, loaded: true });
    });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  return state;
}

function sortByNumero<T extends { numero: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => compareNumero(a.numero, b.numero));
}

function subprincipioSubSubPrincipios(sp: Subprincipio): SubSubPrincipio[] {
  return [...sp.subSubPrincipios, ...sp.zonas.flatMap((z) => z.subSubPrincipios)];
}

function uniqueHabilidadNames(ssp: SubSubPrincipio): string[] {
  return Array.from(new Set(ssp.habilidades.map((h) => h.nombre)));
}

interface SelectionProps {
  relations: ExerciseModelRelationRequest[];
  onChange: (relations: ExerciseModelRelationRequest[]) => void;
}

function CollapsibleHeader({
  label,
  expanded,
  onToggle,
  className,
  badge,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  className: string;
  badge?: number;
}) {
  return (
    <button type="button" className={className} onClick={onToggle} aria-expanded={expanded}>
      <span className={styles.headerLabel}>{label}</span>
      {badge ? (
        <span className={styles.selectedBadge} aria-hidden="true">
          {badge}
        </span>
      ) : null}
      <ExpandMoreIcon fontSize="small" className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`} aria-hidden="true" />
    </button>
  );
}

function SubSubPrincipioRow({
  ssp,
  subprincipioId,
  relations,
  onChange,
}: SelectionProps & { ssp: SubSubPrincipio; subprincipioId: string }) {
  const id = ssp.apiId ?? "";
  const selectedItem = findSelectedItem(relations, id);
  const label = `${ssp.numero} · ${ssp.rol}`;
  const habilidades = uniqueHabilidadNames(ssp);

  return (
    <div className={`${styles.sspRow} ${selectedItem ? styles.sspRowSelected : ""}`}>
      <label className={styles.sspLabel}>
        <Checkbox
          size="small"
          checked={selectedItem !== undefined}
          onChange={() => onChange(toggleSubSubPrincipio(relations, subprincipioId, id))}
          inputProps={{ "aria-label": label }}
          className={styles.sspCheckbox}
        />
        <span>{label}</span>
      </label>
      {ssp.texto && <Typography className={styles.sspTexto}>{ssp.texto}</Typography>}

      {selectedItem && (
        <div className={styles.sspDetail}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={selectedItem.isFoco ? "foco" : "integrado"}
            onChange={(_, value) => value && onChange(setSubSubPrincipioFoco(relations, id, value === "foco"))}
            className={styles.focoToggle}
          >
            <ToggleButton value="foco" className={styles.focoToggleBtn}>
              FOCO
            </ToggleButton>
            <ToggleButton value="integrado" className={styles.focoToggleBtn}>
              INTEGRADO
            </ToggleButton>
          </ToggleButtonGroup>

          {habilidades.length === 0 ? (
            <Typography className={styles.noHabilidades}>Sin habilidades definidas en el modelo.</Typography>
          ) : (
            <div role="group" aria-label={`Habilidades de ${ssp.numero}`} className={styles.habilidades}>
              {habilidades.map((nombre) => {
                const isChosen = selectedItem.habilidades.includes(nombre);
                return (
                  <Chip
                    key={nombre}
                    label={nombre}
                    size="small"
                    clickable
                    aria-pressed={isChosen}
                    variant={isChosen ? "filled" : "outlined"}
                    onClick={() => onChange(toggleSubSubPrincipioHabilidad(relations, id, nombre))}
                    className={isChosen ? styles.habilidadChosen : styles.habilidad}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubprincipioBlock({ sp, relations, onChange }: SelectionProps & { sp: Subprincipio }) {
  const id = sp.apiId ?? "";
  const selectedCount = subprincipioSubSubPrincipios(sp).filter((s) => findSelectedItem(relations, s.apiId ?? "")).length;
  const [expanded, setExpanded] = useState(selectedCount > 0);
  const generalSsps = sortByNumero(sp.subSubPrincipios);

  return (
    <div className={styles.subprincipio}>
      <CollapsibleHeader
        label={`${sp.numero} · ${sp.titulo}`}
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
        className={styles.subprincipioHeader}
        badge={selectedCount}
      />
      {expanded && (
        <div className={styles.subprincipioBody}>
          {sp.zonas.map((zona) => (
            <div key={zona.id} className={styles.zona}>
              <Typography className={styles.zonaTitle}>{zonaHeading(zona)}</Typography>
              {sortByNumero(zona.subSubPrincipios).map((ssp) => (
                <SubSubPrincipioRow key={ssp.id} ssp={ssp} subprincipioId={id} relations={relations} onChange={onChange} />
              ))}
            </div>
          ))}
          {generalSsps.length > 0 && sp.zonas.length > 0 && <Typography className={styles.zonaTitle}>Sin zona</Typography>}
          {generalSsps.map((ssp) => (
            <SubSubPrincipioRow key={ssp.id} ssp={ssp} subprincipioId={id} relations={relations} onChange={onChange} />
          ))}
          {generalSsps.length === 0 && sp.zonas.length === 0 && (
            <Typography className={styles.noHabilidades}>Este subprincipio no tiene sub-subprincipios.</Typography>
          )}
        </div>
      )}
    </div>
  );
}

function PrincipleBlock({ principle, relations, onChange }: SelectionProps & { principle: Principle }) {
  const selectedCount = principle.subprincipios
    .flatMap(subprincipioSubSubPrincipios)
    .filter((s) => findSelectedItem(relations, s.apiId ?? "")).length;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={styles.principle}>
      <CollapsibleHeader
        label={`${principle.numero}. ${principle.titulo}`}
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
        className={styles.principleHeader}
        badge={selectedCount}
      />
      {expanded &&
        sortByNumero(principle.subprincipios).map((sp) => (
          <SubprincipioBlock key={sp.id} sp={sp} relations={relations} onChange={onChange} />
        ))}
    </div>
  );
}

function MomentSection({ momentName, children }: { momentName: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <section className={styles.moment}>
      <CollapsibleHeader
        label={momentName}
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
        className={styles.momentHeader}
      />
      {expanded && children}
    </section>
  );
}

interface ModelRelationSectionProps {
  modelRelations: ExerciseModelRelationRequest[];
  onChange: (relations: ExerciseModelRelationRequest[]) => void;
  teamId?: string;
}

export default function ModelRelationSection({ modelRelations, onChange, teamId }: ModelRelationSectionProps) {
  const { gameModel, loaded } = useTeamGameModel(teamId);
  const hasGameModel = (gameModel?.principles.length ?? 0) > 0;

  const moments = useMemo(() => {
    if (!gameModel) return [];
    const momentIds = Array.from(new Set(gameModel.principles.map((p) => p.gameMomentId))).sort((a, b) => a - b);
    return momentIds.map((momentId) => {
      const principles = gameModel.principles
        .filter((p) => p.gameMomentId === momentId)
        .sort((a, b) => a.numero - b.numero);
      return { momentId, name: principles[0]?.gameMomentName ?? `Fase ${momentId}`, principles };
    });
  }, [gameModel]);

  const subprincipioLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const principle of gameModel?.principles ?? []) {
      for (const sp of principle.subprincipios) {
        if (sp.apiId) labels.set(sp.apiId, `${sp.numero} · ${sp.titulo}`);
      }
    }
    return labels;
  }, [gameModel]);

  const legacyRelations = modelRelations
    .map((relation, index) => ({ relation, index }))
    .filter(({ relation }) => relation.items.length === 0);

  return (
    <Box className={styles.root}>
      <Typography className={styles.title}>Relación con el modelo de juego</Typography>

      {loaded && !hasGameModel && (
        <Typography className={styles.noGameModelHint}>
          Añade primero el{" "}
          <RouterLink to="/coach/game-model" className={styles.noGameModelLink}>
            Modelo ADN
          </RouterLink>{" "}
          del equipo para poder enlazar sub-subprincipios.
        </Typography>
      )}

      {hasGameModel && (
        <Typography className={styles.hint}>
          Marca los sub-subprincipios que trabaja el ejercicio y elige qué habilidades de cada uno.
        </Typography>
      )}

      {legacyRelations.length > 0 && (
        <div className={styles.legacy}>
          <Typography className={styles.zonaTitle}>Vínculos sin sub-subprincipios</Typography>
          {legacyRelations.map(({ relation, index }) => {
            const label = subprincipioLabels.get(relation.subprincipioId) ?? relation.subprincipioId;
            return (
              <div key={`${relation.subprincipioId}-${index}`} className={styles.legacyRow}>
                <span className={styles.headerLabel}>{label}</span>
                <IconButton
                  size="small"
                  onClick={() => onChange(modelRelations.filter((_, i) => i !== index))}
                  aria-label={`Eliminar vínculo ${label}`}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </div>
            );
          })}
        </div>
      )}

      {moments.map((moment) => (
        <MomentSection key={moment.momentId} momentName={moment.name}>
          {moment.principles.map((principle) => (
            <PrincipleBlock key={principle.id} principle={principle} relations={modelRelations} onChange={onChange} />
          ))}
        </MomentSection>
      ))}
    </Box>
  );
}
