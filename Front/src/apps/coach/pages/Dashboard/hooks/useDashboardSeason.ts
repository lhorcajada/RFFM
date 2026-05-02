import { useState } from "react";

export function useDashboardSeason() {
  const [selectedSeason, setSelectedSeason] = useState<string>(() => {
    try {
      return sessionStorage.getItem("coach_selected_season") || "";
    } catch {
      return "";
    }
  });

  function handleSeasonChange(v: string | null) {
    const vv = v ?? "";
    setSelectedSeason(vv);
    try {
      sessionStorage.setItem("coach_selected_season", vv);
    } catch {}
  }

  return { selectedSeason, handleSeasonChange };
}
