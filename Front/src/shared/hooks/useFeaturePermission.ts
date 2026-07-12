import { useEffect, useState } from "react";
import { getMyPermissions } from "../services/permissions/permissionService";

export function useFeaturePermission(featureRoute: string) {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getMyPermissions()
      .then((res) => {
        if (!mounted) return;
        setHasAccess(res.featurePermissions.some((p) => p.featureRoute === featureRoute));
      })
      .catch(() => {
        if (mounted) setHasAccess(false);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [featureRoute]);

  return { hasAccess, loading };
}
