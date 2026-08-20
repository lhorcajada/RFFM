import { useEffect, useState } from "react";
import { Autocomplete, Box, Button, IconButton, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Link as RouterLink } from "react-router-dom";
import gameModelService from "../../../../services/gameModelService";
import seasonService from "../../../../services/seasonService";
import { HABILIDAD_VOCABULARY } from "../../../../types/gameModel";
import type { AdnOptions } from "../../../../types/seasonPlan";
import type { ExerciseModelLinkRequest } from "../../../../types/training";
import styles from "./ModelRelationSection.module.css";

/** Combined option offered by the per-row picker — a Subprincipio or a SubSubPrincipio,
 * never both (mirrors the backend's "exactly one parent" invariant on ExerciseModelLink). */
type AdnLinkOption =
  | { kind: "subprincipio"; id: string; label: string }
  | { kind: "subSubPrincipio"; id: string; label: string };

function useAdnOptions(teamId?: string): AdnOptions {
  const [options, setOptions] = useState<AdnOptions>({ subprincipios: [], subSubPrincipios: [] });

  useEffect(() => {
    if (!teamId) {
      setOptions({ subprincipios: [], subSubPrincipios: [] });
      return;
    }
    let cancelled = false;

    async function load() {
      const activeSeason = await seasonService.getActiveSeason();
      const seasonLabel = activeSeason?.name ?? activeSeason?.id;
      if (!seasonLabel) return;
      const result = await gameModelService.getAdnOptions(teamId as string, seasonLabel);
      if (!cancelled) setOptions(result);
    }

    void load().catch(() => {
      if (!cancelled) setOptions({ subprincipios: [], subSubPrincipios: [] });
    });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  return options;
}

interface ModelRelationSectionProps {
  modelLinks: ExerciseModelLinkRequest[];
  habilidades: string[];
  onChangeModelLinks: (links: ExerciseModelLinkRequest[]) => void;
  onChangeHabilidades: (habilidades: string[]) => void;
  teamId?: string;
}

export default function ModelRelationSection({
  modelLinks,
  habilidades,
  onChangeModelLinks,
  onChangeHabilidades,
  teamId,
}: ModelRelationSectionProps) {
  const adnOptions = useAdnOptions(teamId);
  const hasGameModel = adnOptions.subprincipios.length > 0 || adnOptions.subSubPrincipios.length > 0;

  const linkOptions: AdnLinkOption[] = [
    ...adnOptions.subprincipios.map((s) => ({
      kind: "subprincipio" as const,
      id: s.id,
      label: `${s.numero} · ${s.titulo}`,
    })),
    ...adnOptions.subSubPrincipios.map((s) => ({
      kind: "subSubPrincipio" as const,
      id: s.id,
      label: `${s.numero} · ${s.rol}`,
    })),
  ];

  const updateLink = (index: number, changes: Partial<ExerciseModelLinkRequest>) => {
    onChangeModelLinks(modelLinks.map((link, i) => (i === index ? { ...link, ...changes } : link)));
  };

  const removeLink = (index: number) => {
    onChangeModelLinks(modelLinks.filter((_, i) => i !== index));
  };

  const addLink = () => {
    onChangeModelLinks([...modelLinks, { subprincipioId: null, subSubPrincipioId: null, isFoco: true }]);
  };

  return (
    <Box className={styles.root}>
      <Typography className={styles.title}>Relación con el modelo de juego</Typography>

      {!hasGameModel && (
        <Typography className={styles.noGameModelHint}>
          Añade primero el{" "}
          <RouterLink to="/coach/game-model" className={styles.noGameModelLink}>
            Modelo ADN
          </RouterLink>{" "}
          del equipo para poder enlazar subprincipios.
        </Typography>
      )}

      {modelLinks.map((link, index) => {
        const selected =
          linkOptions.find(
            (o) =>
              (o.kind === "subprincipio" && o.id === link.subprincipioId) ||
              (o.kind === "subSubPrincipio" && o.id === link.subSubPrincipioId)
          ) ?? null;

        return (
          <Box key={index} className={styles.linkRow}>
            <Autocomplete<AdnLinkOption, false>
              size="small"
              disabled={!hasGameModel}
              options={linkOptions}
              groupBy={(o) => (o.kind === "subprincipio" ? "Subprincipio" : "SubSubPrincipio")}
              getOptionLabel={(o) => o.label}
              isOptionEqualToValue={(a, b) => a.kind === b.kind && a.id === b.id}
              value={selected}
              onChange={(_, value) =>
                updateLink(index, {
                  subprincipioId: value?.kind === "subprincipio" ? value.id : null,
                  subSubPrincipioId: value?.kind === "subSubPrincipio" ? value.id : null,
                })
              }
              renderInput={(params) => <TextField {...params} label="Subprincipio / SubSubPrincipio" />}
              className={styles.linkPicker}
            />
            <ToggleButtonGroup
              exclusive
              size="small"
              value={link.isFoco ? "foco" : "integrado"}
              onChange={(_, value) => value && updateLink(index, { isFoco: value === "foco" })}
              className={styles.focoToggle}
            >
              <ToggleButton value="foco" className={styles.focoToggleBtn}>
                FOCO
              </ToggleButton>
              <ToggleButton value="integrado" className={styles.focoToggleBtn}>
                INTEGRADO
              </ToggleButton>
            </ToggleButtonGroup>
            <IconButton size="small" onClick={() => removeLink(index)} aria-label="Eliminar vínculo">
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Box>
        );
      })}

      <Button size="small" startIcon={<AddIcon />} onClick={addLink} className={styles.addLinkBtn}>
        Añadir vínculo
      </Button>

      <Autocomplete<string, true>
        multiple
        size="small"
        options={HABILIDAD_VOCABULARY as unknown as string[]}
        value={habilidades}
        onChange={(_, value) => onChangeHabilidades(value)}
        renderInput={(params) => <TextField {...params} label="Habilidades" />}
        className={styles.habilidadesPicker}
      />
    </Box>
  );
}
