import { useEffect, useState } from "react";
import { getFeatureFlags, type FeatureFlagName, type FeatureFlags } from "../services/featureFlagsService";

// Una sola petición por sesión compartida entre todos los usos del hook. Un fallo no se cachea:
// el siguiente uso vuelve a consultar, y mientras tanto el flag se considera apagado.
let flagsRequest: Promise<FeatureFlags> | null = null;

function loadFlags(): Promise<FeatureFlags> {
  if (!flagsRequest) {
    const request = getFeatureFlags();
    flagsRequest = request;
    request.catch(() => {
      if (flagsRequest === request) flagsRequest = null;
    });
  }
  return flagsRequest;
}

export function resetFeatureFlagsCache() {
  flagsRequest = null;
}

export function useFeatureFlag(name: FeatureFlagName): { enabled: boolean; loading: boolean } {
  const [state, setState] = useState<{ enabled: boolean; loading: boolean }>({ enabled: false, loading: true });

  useEffect(() => {
    let mounted = true;
    loadFlags()
      .then((flags) => {
        if (mounted) setState({ enabled: flags[name] === true, loading: false });
      })
      .catch(() => {
        if (mounted) setState({ enabled: false, loading: false });
      });
    return () => {
      mounted = false;
    };
  }, [name]);

  return state;
}
