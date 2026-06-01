import React, { useEffect, useState } from "react";
import seasonService, { type Season } from "../../../../../services/seasonService";
import SeasonManager from "../SeasonManager/SeasonManager";

interface SeasonsSelectorProps {
  clubId?: string | null;
}

const SeasonsSelector: React.FC<SeasonsSelectorProps> = ({ clubId }) => {
  const [seasons, setSeasons] = useState<Season[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!clubId) {
        setSeasons([]);
        return;
      }
      const seasonsResp = await seasonService.getSeasons(clubId);
      setSeasons(seasonsResp);
    };
    load();
  }, [clubId]);

  return (
    <SeasonManager
      clubId={clubId ?? ""}
      onChanged={async () => {
        if (!clubId) return;
        const latestSeasons = await seasonService.getSeasons(clubId);
        setSeasons(latestSeasons);
      }}
    />
  );
};

export default SeasonsSelector;
