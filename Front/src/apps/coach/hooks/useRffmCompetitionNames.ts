import { useEffect, useState } from "react";
import rffmCompetitionService from "../services/rffmCompetitionService";

type CompetitionNames = {
  competitionName: string | null;
  groupName: string | null;
};

const EMPTY: CompetitionNames = { competitionName: null, groupName: null };

export default function useRffmCompetitionNames(
  competitionId?: number | null,
  groupId?: number | null,
): CompetitionNames {
  const [names, setNames] = useState<CompetitionNames>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    if (!competitionId || !groupId) {
      setNames(EMPTY);
      return;
    }

    Promise.all([
      rffmCompetitionService.getCompetitions(),
      rffmCompetitionService.getGroups(competitionId),
    ])
      .then(([competitions, groups]) => {
        if (cancelled) return;
        setNames({
          competitionName: competitions.find((c) => c.id === competitionId)?.name ?? null,
          groupName: groups.find((g) => g.id === groupId)?.name ?? null,
        });
      })
      .catch(() => {
        if (!cancelled) setNames(EMPTY);
      });

    return () => {
      cancelled = true;
    };
  }, [competitionId, groupId]);

  return names;
}
