import React, { createContext, useContext, useEffect, useState } from "react";
import {
  getRffmSeasons,
  saveRffmSeasonPreference,
  type RffmSeasonOption,
} from "../services/rffmSeasonService";

interface RffmSeasonContextType {
  seasonId: number | null;
  seasons: RffmSeasonOption[];
  setSeasonId: (seasonId: number) => void;
}

const RffmSeasonContext = createContext<RffmSeasonContextType | null>(null);

export const RffmSeasonProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [seasonId, setSeasonIdState] = useState<number | null>(null);
  const [seasons, setSeasons] = useState<RffmSeasonOption[]>([]);

  useEffect(() => {
    let mounted = true;

    async function fetchSeasons() {
      try {
        const response = await getRffmSeasons();
        if (!mounted) return;
        setSeasons(response.seasons);
        setSeasonIdState(
          response.preferredSeasonId ?? response.currentSeasonId,
        );
      } catch (e) {
        // ignore — leave seasonId null, callers fall back to their own default
      }
    }

    // Initial load. If this fires before login (e.g. app just mounted on the
    // login screen), the request 401s and is swallowed above — re-fetch once
    // the auth token becomes available so the selector doesn't stay empty
    // for the rest of the session.
    void fetchSeasons();

    window.addEventListener("rffm.coach_token_updated", fetchSeasons);
    window.addEventListener("rffm.login_success", fetchSeasons);

    return () => {
      mounted = false;
      window.removeEventListener("rffm.coach_token_updated", fetchSeasons);
      window.removeEventListener("rffm.login_success", fetchSeasons);
    };
  }, []);

  function setSeasonId(nextSeasonId: number) {
    setSeasonIdState(nextSeasonId);
    saveRffmSeasonPreference(nextSeasonId).catch(() => {
      // fire-and-forget: keep the optimistic UI update even if the save fails
    });
  }

  return (
    <RffmSeasonContext.Provider value={{ seasonId, seasons, setSeasonId }}>
      {children}
    </RffmSeasonContext.Provider>
  );
};

export const useRffmSeason = () => {
  const context = useContext(RffmSeasonContext);
  if (!context) {
    throw new Error("useRffmSeason debe ser usado dentro de RffmSeasonProvider");
  }
  return context;
};
