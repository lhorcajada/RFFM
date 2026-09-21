import { useEffect, useRef } from "react";
import { useRffmSeason } from "../context/RffmSeasonContext";

export default function useClearOnSeasonChange(onClear: () => void) {
  const { seasonChangeToken } = useRffmSeason();
  const previousTokenRef = useRef(seasonChangeToken);
  const onClearRef = useRef(onClear);
  onClearRef.current = onClear;

  useEffect(() => {
    if (previousTokenRef.current === seasonChangeToken) return;
    previousTokenRef.current = seasonChangeToken;
    onClearRef.current();
  }, [seasonChangeToken]);
}
