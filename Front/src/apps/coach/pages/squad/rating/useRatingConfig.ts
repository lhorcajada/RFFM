import { useCallback, useEffect, useMemo, useState } from "react";
import { getRatingConfig } from "../../../services/ratingConfigService";
import { EMPTY_RATING_CONFIG, type RatingConfig } from "../../../types/ratingConfig";
import {
  DEFAULT_SHEET_CATALOG,
  mergeCapacities,
  mergeTraits,
  visibleCapacities,
  visibleTraits,
  type EffectiveCapacities,
  type EffectiveTrait,
  type SheetCatalog,
} from "./ratingCatalog";
import { TRAIT_CATALOG } from "./ratingTraits";

export type RatingConfigState = {
  loading: boolean;
  /** La lectura falló: se usan los valores por defecto. */
  error: boolean;
  config: RatingConfig;
  /** Todos los rasgos del equipo, también los ocultos (para configurar). */
  traits: EffectiveTrait[];
  /** Rasgos que se piden al valorar y cuentan en el encaje. */
  visibleTraits: EffectiveTrait[];
  /** Todas las capacidades del equipo por hoja, también las ocultas (para configurar). */
  capacities: EffectiveCapacities;
  /** Capacidades que se piden en la hoja de capacidad. */
  visibleSheetCatalog: SheetCatalog;
  reload: () => Promise<void>;
};

/** Catálogo efectivo del equipo: valores por defecto + personalizaciones. Sin equipo o si falla, los valores por defecto. */
export function useRatingConfig(teamId: string | null): RatingConfigState {
  const [config, setConfig] = useState<RatingConfig>(EMPTY_RATING_CONFIG);
  const [loading, setLoading] = useState<boolean>(teamId != null);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    if (!teamId) {
      setLoading(false);
      return;
    }
    try {
      setConfig(await getRatingConfig(teamId));
      setError(false);
    } catch {
      setConfig(EMPTY_RATING_CONFIG);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const traits = useMemo(() => mergeTraits(TRAIT_CATALOG, config.traits), [config.traits]);
  const capacities = useMemo(() => mergeCapacities(DEFAULT_SHEET_CATALOG, config.capacities), [config.capacities]);

  const visible = useMemo(() => visibleTraits(traits), [traits]);
  const visibleSheetCatalog = useMemo<SheetCatalog>(
    () => ({ field: visibleCapacities(capacities.field), goalkeeper: visibleCapacities(capacities.goalkeeper) }),
    [capacities],
  );

  return { loading, error, config, traits, visibleTraits: visible, capacities, visibleSheetCatalog, reload };
}
