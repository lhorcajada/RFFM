import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, ToggleButton, ToggleButtonGroup } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";

import { usePermissions } from "../../../../../shared/hooks/usePermissions";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import ConfirmDialog from "../../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import {
  createCapacity,
  createTrait,
  setCapacityVisibility,
  setTraitVisibility,
  updateCapacity,
  updateTrait,
  type UpdateCapacityPayload,
  type UpdateTraitPayload,
} from "../../../services/ratingConfigService";
import CapacityConfigDialog, { SHEET_LABELS, type CapacityFormValues } from "./components/CapacityConfigDialog";
import ConfigItemCard from "./components/ConfigItemCard";
import RatingViewSwitcher from "./components/RatingViewSwitcher";
import TraitConfigDialog, { type TraitFormValues } from "./components/TraitConfigDialog";
import type { EffectiveCapacity, EffectiveTrait } from "./ratingCatalog";
import { getCategoryLabel } from "./ratingConcepts";
import { TRAIT_PHASE_LABELS, type TraitPhase } from "./ratingTraits";
import { squadSearchFrom, useRatingView } from "./ratingViews";
import { useRatingConfig } from "./useRatingConfig";
import type { SheetKind } from "../../../types/ratingConfig";

import styles from "./RatingConfigPage.module.css";

type Tab = "capacities" | "traits";

type TraitDialogState = { mode: "create" } | { mode: "edit"; trait: EffectiveTrait };
type CapacityDialogState = { mode: "create" } | { mode: "edit"; capacity: EffectiveCapacity; sheet: SheetKind };
type HideTarget =
  | { kind: "trait"; trait: EffectiveTrait }
  | { kind: "capacity"; capacity: EffectiveCapacity; sheet: SheetKind };

const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: "capacities", label: "Capacidades" },
  { value: "traits", label: "Rasgos" },
];

const PHASES = Object.keys(TRAIT_PHASE_LABELS) as TraitPhase[];
const SHEETS: SheetKind[] = ["field", "goalkeeper"];

function showSnackbar(message: string, severity: "success" | "error") {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }));
}

function traitFormOf(trait: EffectiveTrait): TraitFormValues {
  return { label: trait.label, phase: trait.phase, anchor1: trait.anchors[1], anchor3: trait.anchors[3], anchor5: trait.anchors[5] };
}

function capacityFormOf(capacity: EffectiveCapacity, sheet: SheetKind): CapacityFormValues {
  return {
    sheet,
    categoryKey: capacity.categoryKey,
    label: capacity.label,
    levelTexts: capacity.levels.map((level) => level.concept),
  };
}

export default function RatingConfigPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [view, setView] = useRatingView();
  const { roles } = usePermissions();
  const canManage = roles.includes("Coach") || roles.includes("Administrator");
  const teamId = searchParams.get("teamId");

  const { loading, error, traits, capacities, reload } = useRatingConfig(teamId);

  const [tab, setTab] = useState<Tab>("capacities");
  const [traitDialog, setTraitDialog] = useState<TraitDialogState | null>(null);
  const [capacityDialog, setCapacityDialog] = useState<CapacityDialogState | null>(null);
  const [hideTarget, setHideTarget] = useState<HideTarget | null>(null);
  const [saving, setSaving] = useState(false);

  function goBack() {
    navigate(`/coach/squad${squadSearchFrom(searchParams)}`);
  }

  /** Ejecuta un cambio, recarga la configuración y avisa del resultado. */
  async function run(change: () => Promise<unknown>, successMessage: string): Promise<boolean> {
    setSaving(true);
    try {
      await change();
      await reload();
      showSnackbar(successMessage, "success");
      return true;
    } catch {
      showSnackbar("Error al guardar la configuración", "error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submitTrait(values: TraitFormValues) {
    if (!teamId || !traitDialog) return;
    if (traitDialog.mode === "create") {
      if (await run(() => createTrait(teamId, values), "Rasgo creado")) setTraitDialog(null);
      return;
    }
    const original = traitFormOf(traitDialog.trait);
    const changes: UpdateTraitPayload = {};
    if (values.label !== original.label) changes.label = values.label;
    if (values.phase !== original.phase) changes.phase = values.phase;
    if (values.anchor1 !== original.anchor1) changes.anchor1 = values.anchor1;
    if (values.anchor3 !== original.anchor3) changes.anchor3 = values.anchor3;
    if (values.anchor5 !== original.anchor5) changes.anchor5 = values.anchor5;
    if (Object.keys(changes).length === 0) {
      setTraitDialog(null);
      return;
    }
    if (await run(() => updateTrait(teamId, traitDialog.trait.key, changes), "Rasgo actualizado")) setTraitDialog(null);
  }

  async function submitCapacity(values: CapacityFormValues) {
    if (!teamId || !capacityDialog) return;
    if (capacityDialog.mode === "create") {
      if (await run(() => createCapacity(teamId, values), "Capacidad creada")) setCapacityDialog(null);
      return;
    }
    const { capacity, sheet } = capacityDialog;
    const original = capacityFormOf(capacity, sheet);
    const changes: UpdateCapacityPayload = {};
    if (values.label !== original.label) changes.label = values.label;
    if (values.levelTexts.some((text, index) => text !== original.levelTexts[index])) changes.levelTexts = values.levelTexts;
    if (Object.keys(changes).length === 0) {
      setCapacityDialog(null);
      return;
    }
    // El servidor no conoce los textos por defecto: sobre una capacidad por defecto hay que indicar su hoja y su categoría.
    const payload: UpdateCapacityPayload = capacity.isCustom ? changes : { ...changes, sheet, categoryKey: capacity.categoryKey };
    if (await run(() => updateCapacity(teamId, capacity.key, payload), "Capacidad actualizada")) setCapacityDialog(null);
  }

  async function confirmHide() {
    if (!teamId || !hideTarget) return;
    const target = hideTarget;
    setHideTarget(null);
    if (target.kind === "trait") {
      await run(() => setTraitVisibility(teamId, target.trait.key, true), "Rasgo ocultado");
    } else {
      const { capacity, sheet } = target;
      await run(
        () => setCapacityVisibility(teamId, capacity.key, true, { sheet, categoryKey: capacity.categoryKey }),
        "Capacidad ocultada",
      );
    }
  }

  async function restoreTrait(trait: EffectiveTrait) {
    if (!teamId) return;
    await run(() => setTraitVisibility(teamId, trait.key, false), "Rasgo restaurado");
  }

  async function restoreCapacity(capacity: EffectiveCapacity, sheet: SheetKind) {
    if (!teamId) return;
    await run(
      () => setCapacityVisibility(teamId, capacity.key, false, { sheet, categoryKey: capacity.categoryKey }),
      "Capacidad restaurada",
    );
  }

  if (loading) {
    return (
      <BaseLayout hideFooterMenu>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
          <CircularProgress />
        </Box>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Valorar plantilla"
        actionBar={
          <div className={styles.actionBar}>
            <RatingViewSwitcher value={view} hasUnsavedChanges={false} onChange={setView} />
            <div className={styles.actions}>
              <Button size="small" variant="outlined" startIcon={<ArrowBackIcon />} onClick={goBack}>
                Volver
              </Button>
            </div>
          </div>
        }
      >
        {error ? (
          <Alert severity="error">No se pudo cargar la configuración.</Alert>
        ) : (
          <div className={styles.content}>
            <div className={styles.toolbar}>
              <ToggleButtonGroup
                value={tab}
                exclusive
                size="small"
                aria-label="Qué configurar"
                onChange={(_, value: Tab | null) => { if (value) setTab(value); }}
              >
                {TAB_OPTIONS.map(({ value, label }) => (
                  <ToggleButton key={value} value={value} className={styles.toggleBtn}>
                    {label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              {canManage && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => (tab === "traits" ? setTraitDialog({ mode: "create" }) : setCapacityDialog({ mode: "create" }))}
                >
                  {tab === "traits" ? "Añadir rasgo" : "Añadir capacidad"}
                </Button>
              )}
            </div>

            {tab === "capacities" &&
              SHEETS.map((sheet) => (
                <section key={sheet} className={styles.group}>
                  <h3 className={styles.groupTitle}>{SHEET_LABELS[sheet]}</h3>
                  <ul className={styles.list}>
                    {capacities[sheet].map((capacity) => (
                      <ConfigItemCard
                        key={capacity.key}
                        label={capacity.label}
                        detail={getCategoryLabel(capacity.categoryKey)}
                        isCustom={capacity.isCustom}
                        isHidden={capacity.isHidden}
                        canManage={canManage}
                        onEdit={() => setCapacityDialog({ mode: "edit", capacity, sheet })}
                        onHide={() => setHideTarget({ kind: "capacity", capacity, sheet })}
                        onRestore={() => void restoreCapacity(capacity, sheet)}
                      />
                    ))}
                  </ul>
                </section>
              ))}

            {tab === "traits" &&
              PHASES.map((phase) => (
                <section key={phase} className={styles.group}>
                  <h3 className={styles.groupTitle}>{TRAIT_PHASE_LABELS[phase]}</h3>
                  <ul className={styles.list}>
                    {traits
                      .filter((trait) => trait.phase === phase)
                      .map((trait) => (
                        <ConfigItemCard
                          key={trait.key}
                          label={trait.label}
                          isCustom={trait.isCustom}
                          isHidden={trait.isHidden}
                          canManage={canManage}
                          onEdit={() => setTraitDialog({ mode: "edit", trait })}
                          onHide={() => setHideTarget({ kind: "trait", trait })}
                          onRestore={() => void restoreTrait(trait)}
                        />
                      ))}
                  </ul>
                </section>
              ))}
          </div>
        )}
      </ContentLayout>

      {traitDialog && (
        <TraitConfigDialog
          mode={traitDialog.mode}
          initial={traitDialog.mode === "edit" ? traitFormOf(traitDialog.trait) : undefined}
          saving={saving}
          onCancel={() => setTraitDialog(null)}
          onSubmit={(values) => void submitTrait(values)}
        />
      )}

      {capacityDialog && (
        <CapacityConfigDialog
          mode={capacityDialog.mode}
          initial={capacityDialog.mode === "edit" ? capacityFormOf(capacityDialog.capacity, capacityDialog.sheet) : undefined}
          saving={saving}
          onCancel={() => setCapacityDialog(null)}
          onSubmit={(values) => void submitCapacity(values)}
        />
      )}

      <ConfirmDialog
        open={hideTarget !== null}
        title={hideTarget?.kind === "capacity" ? "Ocultar capacidad" : "Ocultar rasgo"}
        description="Dejará de aparecer al valorar. Las valoraciones ya guardadas se conservan y puedes restaurarla cuando quieras."
        confirmText="Ocultar"
        onCancel={() => setHideTarget(null)}
        onConfirm={() => void confirmHide()}
      />
    </BaseLayout>
  );
}
