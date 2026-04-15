import { useRef } from "react";
import { exportEvaluationsToExcel, importEvaluationsFromExcel } from "../evaluationExcel";
import type { ImportResult } from "../evaluationExcel";
import type { PoolPlayer } from "../../SeasonPrep";

/**
 * Handles Excel export and import, including the hidden file input ref.
 * Returns the file input ref and the two handlers.
 */
export function useEvaluationExcel(
  pool: PoolPlayer[],
  fedSeason: string,
  onImportDone: (updatedPlayers: PoolPlayer[], result: ImportResult) => void,
  onExportError: () => void
) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    exportEvaluationsToExcel(pool, fedSeason).catch(onExportError);
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    importEvaluationsFromExcel(file, pool, onImportDone);
    e.target.value = "";
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  return { fileInputRef, handleExport, handleImportFile, openFilePicker };
}
