import { useEffect, useState } from "react";
import { clubJoinRequestsApi } from "../../../../../../shared/services/clubJoinRequests/clubJoinRequestsApi";

export function useClubPendingRequests(clubId: string | undefined) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(Boolean(clubId));

  useEffect(() => {
    if (!clubId) return;
    let mounted = true;
    setLoading(true);
    clubJoinRequestsApi
      .getPendingCount(clubId)
      .then((n) => mounted && setCount(n))
      .catch(() => mounted && setCount(0))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [clubId]);

  return { count, loading };
}
