import { useState, useEffect } from "react";
import { getDemarcations } from "../../../../services/demarcationService";

/**
 * Loads the list of available position names from the demarcation catalog.
 */
export function usePositionOptions(): string[] {
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    getDemarcations()
      .then((list) => setOptions(list.map((d) => d.name)))
      .catch(() => {});
  }, []);

  return options;
}
