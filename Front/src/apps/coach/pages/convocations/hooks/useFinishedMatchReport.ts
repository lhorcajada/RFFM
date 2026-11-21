import { useEffect, useState } from "react";
import { getMatchReport, type MatchReport } from "../../../services/matchReportService";

export type FinishedMatchReportStatus = "idle" | "loading" | "ready" | "error";

export type UseFinishedMatchReportReturn = {
  report: MatchReport | null;
  status: FinishedMatchReportStatus;
};

/** Carga el informe del partido solo cuando el partido ha finalizado (`enabled`). */
export function useFinishedMatchReport(eventId: string, enabled: boolean): UseFinishedMatchReportReturn {
  const [report, setReport] = useState<MatchReport | null>(null);
  const [status, setStatus] = useState<FinishedMatchReportStatus>("idle");

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setStatus("loading");
    getMatchReport(eventId)
      .then((data) => {
        if (cancelled) return;
        setReport(data);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setReport(null);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, enabled]);

  return { report, status };
}
