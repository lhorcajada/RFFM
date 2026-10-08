import { useEffect, useMemo, useState } from "react";
import { getTeamMatchReports, type MatchReportAvailability } from "../services/matchReportService";

type MatchReportIndex = {
  byEventId: Record<string, MatchReportAvailability>;
  byCodActa: Record<string, MatchReportAvailability>;
};

/** Partidos del equipo con acta disponible (federación o partido en directo), para mostrar «Ver acta». */
export default function useTeamMatchReports(teamId: string | undefined): MatchReportIndex {
  const [reports, setReports] = useState<MatchReportAvailability[]>([]);

  useEffect(() => {
    setReports([]);
    if (!teamId) return;
    let mounted = true;
    getTeamMatchReports(teamId)
      .then((data) => {
        if (mounted) setReports(data);
      })
      .catch(() => {
        if (mounted) setReports([]);
      });
    return () => {
      mounted = false;
    };
  }, [teamId]);

  return useMemo(() => {
    const byEventId: Record<string, MatchReportAvailability> = {};
    const byCodActa: Record<string, MatchReportAvailability> = {};
    for (const report of reports) {
      byEventId[report.eventId] = report;
      if (report.codActa) byCodActa[report.codActa] = report;
    }
    return { byEventId, byCodActa };
  }, [reports]);
}
