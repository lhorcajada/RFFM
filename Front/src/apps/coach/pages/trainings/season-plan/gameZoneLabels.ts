// GameZone catalog (ids 1–4), matching GameModelKeys.ZoneKeysById in the backend and
// ZONE_KEY_OPTIONS in types/gameModel.ts. Mesociclo.gameZoneId is a required FK into
// this fixed catalog — kept as a local label lookup since the id→label mapping never
// changes; the selectable list itself comes from gameModelService.getZones().
export const GAME_ZONE_LABELS: Record<number, string> = {
  1: "Iniciación",
  2: "Creación Propia",
  3: "Creación Rival",
  4: "Finalización",
};
