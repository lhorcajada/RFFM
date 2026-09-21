import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  getRffmSeasons,
  saveRffmSeasonPreference,
  type RffmSeasonOption,
} from "../services/rffmSeasonService";

interface RffmSeasonContextType {
  seasonId: number | null;
  currentSeasonId: number | null;
  seasons: RffmSeasonOption[];
  seasonChangeToken: number;
  setSeasonId: (seasonId: number) => void;
  applySeasonId: (seasonId?: number | null) => void;
}

const RffmSeasonContext = createContext<RffmSeasonContextType | null>(null);

export const RffmSeasonProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [seasonId, setSeasonIdState] = useState<number | null>(null);
  const [seasons, setSeasons] = useState<RffmSeasonOption[]>([]);
  const [seasonChangeToken, setSeasonChangeToken] = useState(0);
  const [currentSeasonId, setCurrentSeasonId] = useState<number | null>(null);
  const currentSeasonIdRef = useRef<number | null>(null);
  const appliedRef = useRef<{ seasonId: number | null } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchSeasons() {
      try {
        const response = await getRffmSeasons();
        if (!mounted) return;
        setSeasons(response.seasons);
        currentSeasonIdRef.current = response.currentSeasonId;
        setCurrentSeasonId(response.currentSeasonId);
        const applied = appliedRef.current;
        setSeasonIdState(
          applied
            ? (applied.seasonId ?? response.currentSeasonId)
            : (response.preferredSeasonId ?? response.currentSeasonId),
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
    appliedRef.current = null;
    setSeasonIdState(nextSeasonId);
    setSeasonChangeToken((token) => token + 1);
    saveRffmSeasonPreference(nextSeasonId).catch(() => {
      // fire-and-forget: keep the optimistic UI update even if the save fails
    });
  }

  // Applies the season of a saved configuration: no preference is persisted and
  // no page selection is cleared (only user changes bump seasonChangeToken).
  // Configurations saved before seasons existed have none: they were built with
  // the current season, so that is the fallback. If the seasons have not loaded
  // yet the choice is remembered and wins over the stored preference.
  const applySeasonId = useCallback((nextSeasonId?: number | null) => {
    appliedRef.current = { seasonId: nextSeasonId ?? null };
    const target = nextSeasonId ?? currentSeasonIdRef.current;
    if (target != null) setSeasonIdState(target);
  }, []);

  return (
    <RffmSeasonContext.Provider
      value={{
        seasonId,
        currentSeasonId,
        seasons,
        seasonChangeToken,
        setSeasonId,
        applySeasonId,
      }}
    >
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
