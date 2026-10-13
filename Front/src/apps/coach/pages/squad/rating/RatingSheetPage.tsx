import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";

import { usePermissions } from "../../../../../shared/hooks/usePermissions";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import ConfirmDialog from "../../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import RatingSheetBoard, { playerDisplayName } from "./components/RatingSheetBoard";
import {
  DEFENDER_CATEGORY,
  FORWARD_CATEGORY,
  MIDFIELDER_CATEGORY,
  positionCategory,
} from "./positionCategory";
import { getCategoryLabel, type CategoryKey, type CharacteristicDef } from "./ratingConcepts";
import { characteristicsFor, sheetOf, type SheetType } from "./ratingSheet";
import { useRatingSheet } from "./useRatingSheet";

import styles from "./RatingSheetPage.module.css";

type LineFilter = "all" | number;

const SHEET_OPTIONS: { value: SheetType; label: string }[] = [
  { value: "field", label: "Jugadores" },
  { value: "goalkeeper", label: "Porteros" },
];

const LINE_OPTIONS: { value: LineFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: DEFENDER_CATEGORY, label: "Defensas" },
  { value: MIDFIELDER_CATEGORY, label: "Medios" },
  { value: FORWARD_CATEGORY, label: "Delanteros" },
];

function showSnackbar(message: string, severity: "success" | "error") {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }));
}

export default function RatingSheetPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isNarrowViewport = useMediaQuery(theme.breakpoints.down("md"));
  const [searchParams] = useSearchParams();
  const squadSearch = searchParams.toString() ? `?${searchParams.toString()}&tab=1` : "?tab=1";
  const { roles } = usePermissions();
  const canRate = roles.includes("Coach") || roles.includes("Administrator");

  const { loading, loadError, saving, players, draft, plan, place, save } = useRatingSheet(
    searchParams.get("teamId"),
    searchParams.get("seasonId"),
  );

  const [sheet, setSheet] = useState<SheetType>("field");
  const [lineFilter, setLineFilter] = useState<LineFilter>("all");
  const [selectedKeyBySheet, setSelectedKeyBySheet] = useState<Partial<Record<SheetType, string>>>({});
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [ratedAt, setRatedAt] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  const characteristics = characteristicsFor(sheet);
  const selectedChar: CharacteristicDef =
    characteristics.find((c) => c.key === selectedKeyBySheet[sheet]) ?? characteristics[0];

  const sheetPlayers = useMemo(() => players.filter((p) => sheetOf(p) === sheet), [players, sheet]);
  const visiblePlayers = useMemo(
    () =>
      sheet === "goalkeeper" || lineFilter === "all"
        ? sheetPlayers
        : sheetPlayers.filter((p) => positionCategory(p.position) === lineFilter),
    [sheet, sheetPlayers, lineFilter],
  );

  const groupedCharacteristics = useMemo(() => {
    const groups = new Map<CategoryKey, CharacteristicDef[]>();
    for (const c of characteristics) groups.set(c.categoryKey, [...(groups.get(c.categoryKey) ?? []), c]);
    return [...groups.entries()];
  }, [characteristics]);

  const hasUnsavedChanges = plan.items.length > 0 || plan.incompletePlayers.length > 0;

  function progressOf(characteristicKey: string): string {
    const placed = sheetPlayers.filter((p) => draft[p.id]?.[characteristicKey] != null).length;
    return `${placed}/${sheetPlayers.length}`;
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function changeSheet(next: SheetType) {
    setSheet(next);
    clearSelection();
  }

  function changeLineFilter(next: LineFilter) {
    setLineFilter(next);
    clearSelection();
  }

  function selectCharacteristic(key: string) {
    setSelectedKeyBySheet((prev) => ({ ...prev, [sheet]: key }));
    clearSelection();
  }

  function togglePlayer(playerId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(playerId)) next.add(playerId);
      return next;
    });
  }

  function placeSelected(level: number | null) {
    if (selectedIds.size === 0) return;
    place([...selectedIds], selectedChar.key, level);
    clearSelection();
  }

  async function handleSave() {
    try {
      const savedCount = await save(ratedAt);
      showSnackbar(
        savedCount === 1 ? "Valoración guardada" : `${savedCount} valoraciones guardadas`,
        "success",
      );
    } catch {
      showSnackbar("Error al guardar las valoraciones", "error");
    }
  }

  function goBack() {
    navigate(`/coach/squad${squadSearch}`);
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
            <ToggleButtonGroup
              value={sheet}
              exclusive
              size="small"
              onChange={(_, value: SheetType | null) => { if (value) changeSheet(value); }}
            >
              {SHEET_OPTIONS.map(({ value, label }) => (
                <ToggleButton key={value} value={value} className={styles.toggleBtn}>
                  {label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            {sheet === "field" && (
              <ToggleButtonGroup
                value={lineFilter}
                exclusive
                size="small"
                onChange={(_, value: LineFilter | null) => { if (value != null) changeLineFilter(value); }}
              >
                {LINE_OPTIONS.map(({ value, label }) => (
                  <ToggleButton key={value} value={value} className={styles.toggleBtn}>
                    {label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            )}

            <div className={styles.actions}>
              {canRate && (
                <TextField
                  label="Fecha de valoración"
                  type="date"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={ratedAt}
                  onChange={(e) => setRatedAt(e.target.value)}
                  className={styles.dateField}
                />
              )}
              <Button
                size="small"
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={() => (hasUnsavedChanges ? setLeaveConfirmOpen(true) : goBack())}
              >
                Volver
              </Button>
              {canRate && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<SaveIcon />}
                  disabled={plan.items.length === 0 || saving}
                  onClick={handleSave}
                >
                  {saving ? "Guardando…" : plan.items.length > 0 ? `Guardar (${plan.items.length})` : "Guardar"}
                </Button>
              )}
            </div>
          </div>
        }
      >
        {loadError ? (
          <Alert severity="error">No se pudieron cargar los jugadores y sus valoraciones.</Alert>
        ) : (
          <>
            {plan.incompletePlayers.length > 0 && (
              <Alert severity="warning" className={styles.incompleteAlert}>
                Sin completar (no se guardarán): {plan.incompletePlayers.map(playerDisplayName).join(", ")}
              </Alert>
            )}

            <div className={`${styles.splitLayout} ${isNarrowViewport ? styles.splitLayoutNarrow : ""}`}>
              {isNarrowViewport ? (
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Característica"
                  value={selectedChar.key}
                  onChange={(e) => selectCharacteristic(e.target.value)}
                >
                  {characteristics.map((c) => (
                    <MenuItem key={c.key} value={c.key}>
                      {getCategoryLabel(c.categoryKey)} · {c.label} ({progressOf(c.key)})
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <div className={styles.leftPanel}>
                  {groupedCharacteristics.map(([categoryKey, categoryChars]) => (
                    <div key={categoryKey} className={styles.categorySection}>
                      <div className={styles.categoryHeader}>{getCategoryLabel(categoryKey)}</div>
                      {categoryChars.map((c) => (
                        <button
                          key={c.key}
                          type="button"
                          className={`${styles.charRow} ${c.key === selectedChar.key ? styles.charRowSelected : ""}`}
                          aria-current={c.key === selectedChar.key}
                          onClick={() => selectCharacteristic(c.key)}
                        >
                          <span className={styles.charLabel}>{c.label}</span>
                          <span className={styles.charProgress}>{progressOf(c.key)}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.rightPanel}>
                <Typography variant="subtitle1" className={styles.boardTitle}>
                  {selectedChar.label}
                </Typography>
                {sheetPlayers.length === 0 ? (
                  <Typography className={styles.emptyMessage}>
                    {sheet === "goalkeeper" ? "No hay porteros en la plantilla." : "No hay jugadores en la plantilla."}
                  </Typography>
                ) : (
                  <>
                    {canRate && (
                      <Typography variant="caption" className={styles.hint}>
                        Toca uno o varios jugadores y después el nivel donde quieres colocarlos.
                      </Typography>
                    )}
                    <RatingSheetBoard
                      characteristic={selectedChar}
                      players={visiblePlayers}
                      draft={draft}
                      selectedIds={selectedIds}
                      readOnly={!canRate}
                      onTogglePlayer={togglePlayer}
                      onPlace={placeSelected}
                    />
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </ContentLayout>

      <ConfirmDialog
        open={leaveConfirmOpen}
        title="Salir sin guardar"
        description="Hay cambios sin guardar. Si sales ahora, se perderán."
        confirmText="Salir"
        onCancel={() => setLeaveConfirmOpen(false)}
        onConfirm={goBack}
      />
    </BaseLayout>
  );
}
