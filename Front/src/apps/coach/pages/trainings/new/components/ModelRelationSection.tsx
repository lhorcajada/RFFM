import { useEffect, useState } from "react";
import { Autocomplete, Box, Button, IconButton, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Link as RouterLink } from "react-router-dom";
import gameModelService from "../../../../services/gameModelService";
import seasonService from "../../../../services/seasonService";
import { HABILIDAD_VOCABULARY } from "../../../../types/gameModel";
import type { AdnOptions, AdnSubprincipioOption, AdnSubSubPrincipioOption } from "../../../../types/seasonPlan";
import type { ExerciseModelRelationRequest, ExerciseModelRelationItemRequest } from "../../../../types/training";
import styles from "./ModelRelationSection.module.css";

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
  modelRelations: ExerciseModelRelationRequest[];
  onChange: (relations: ExerciseModelRelationRequest[]) => void;
  teamId?: string;
}

export default function ModelRelationSection({ modelRelations, onChange, teamId }: ModelRelationSectionProps) {
  const adnOptions = useAdnOptions(teamId);
  const hasGameModel = adnOptions.subprincipios.length > 0;

  const updateRelation = (index: number, changes: Partial<ExerciseModelRelationRequest>) => {
    onChange(modelRelations.map((r, i) => (i === index ? { ...r, ...changes } : r)));
  };

  const removeRelation = (index: number) => {
    onChange(modelRelations.filter((_, i) => i !== index));
  };

  const addRelation = () => {
    onChange([...modelRelations, { subprincipioId: "", isFoco: true, habilidadesImprescindibles: [], items: [] }]);
  };

  const addItem = (relationIndex: number) => {
    const relation = modelRelations[relationIndex];
    const newItem: ExerciseModelRelationItemRequest = { subSubPrincipioId: "", isFoco: true };
    updateRelation(relationIndex, { items: [...relation.items, newItem] });
  };

  const updateItem = (relationIndex: number, itemIndex: number, changes: Partial<ExerciseModelRelationItemRequest>) => {
    const relation = modelRelations[relationIndex];
    updateRelation(relationIndex, {
      items: relation.items.map((it, i) => (i === itemIndex ? { ...it, ...changes } : it)),
    });
  };

  const removeItem = (relationIndex: number, itemIndex: number) => {
    const relation = modelRelations[relationIndex];
    updateRelation(relationIndex, { items: relation.items.filter((_, i) => i !== itemIndex) });
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

      {modelRelations.map((relation, index) => {
        const selectedSubprincipio =
          adnOptions.subprincipios.find((s) => s.id === relation.subprincipioId) ?? null;
        const childSubSubPrincipios: AdnSubSubPrincipioOption[] = relation.subprincipioId
          ? adnOptions.subSubPrincipios.filter((s) => s.subprincipioId === relation.subprincipioId)
          : [];

        return (
          <Box key={index} className={styles.relationCard}>
            <Box className={styles.relationHeader}>
              <Autocomplete<AdnSubprincipioOption, false>
                size="small"
                disabled={!hasGameModel}
                options={adnOptions.subprincipios}
                getOptionLabel={(o) => `${o.numero} · ${o.titulo}`}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                value={selectedSubprincipio}
                onChange={(_, value) => updateRelation(index, { subprincipioId: value?.id ?? "" })}
                renderInput={(params) => <TextField {...params} label="Subprincipio" />}
                className={styles.subprincipioPicker}
              />
              <ToggleButtonGroup
                exclusive
                size="small"
                value={relation.isFoco ? "foco" : "integrado"}
                onChange={(_, value) => value && updateRelation(index, { isFoco: value === "foco" })}
                className={styles.focoToggle}
              >
                <ToggleButton value="foco" className={styles.focoToggleBtn}>
                  FOCO
                </ToggleButton>
                <ToggleButton value="integrado" className={styles.focoToggleBtn}>
                  INTEGRADO
                </ToggleButton>
              </ToggleButtonGroup>
              <IconButton size="small" onClick={() => removeRelation(index)} aria-label="Eliminar vínculo">
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>

            <Autocomplete<string, true>
              multiple
              size="small"
              options={HABILIDAD_VOCABULARY as unknown as string[]}
              value={relation.habilidadesImprescindibles}
              onChange={(_, value) => updateRelation(index, { habilidadesImprescindibles: value })}
              renderInput={(params) => <TextField {...params} label="Habilidades imprescindibles" />}
              className={styles.habilidadesPicker}
            />

            {relation.items.map((item, itemIndex) => {
              const selectedItem = childSubSubPrincipios.find((s) => s.id === item.subSubPrincipioId) ?? null;
              return (
                <Box key={itemIndex} className={styles.itemRow}>
                  <Autocomplete<AdnSubSubPrincipioOption, false>
                    size="small"
                    options={childSubSubPrincipios}
                    getOptionLabel={(o) => `${o.numero} · ${o.rol}`}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    value={selectedItem}
                    onChange={(_, value) => updateItem(index, itemIndex, { subSubPrincipioId: value?.id ?? "" })}
                    renderInput={(params) => <TextField {...params} label="Acción (X.Y.Z)" />}
                    className={styles.itemPicker}
                  />
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={item.isFoco ? "foco" : "integrado"}
                    onChange={(_, value) => value && updateItem(index, itemIndex, { isFoco: value === "foco" })}
                    className={styles.focoToggle}
                  >
                    <ToggleButton value="foco" className={styles.focoToggleBtn}>
                      FOCO
                    </ToggleButton>
                    <ToggleButton value="integrado" className={styles.focoToggleBtn}>
                      INTEGRADO
                    </ToggleButton>
                  </ToggleButtonGroup>
                  <IconButton size="small" onClick={() => removeItem(index, itemIndex)} aria-label="Eliminar acción">
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
              );
            })}

            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => addItem(index)}
              disabled={!relation.subprincipioId}
              className={styles.addItemBtn}
            >
              Añadir acción (X.Y.Z)
            </Button>
          </Box>
        );
      })}

      <Button size="small" startIcon={<AddIcon />} onClick={addRelation} className={styles.addLinkBtn}>
        Añadir vínculo
      </Button>
    </Box>
  );
}
