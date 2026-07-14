import { useEffect, useState } from "react";
import {
  getMyPermissions,
  type FeaturePermissionDto,
  type PagePermissionDto,
} from "../services/permissions/permissionService";

/**
 * Fetches the current user's full permission set once (role + featurePermissions +
 * pagePermissions) and exposes a `hasFeatureAccess` helper. Prefer this hook over
 * `useFeaturePermission` when a page/component needs to check several feature routes
 * at once (e.g. a dashboard rendering many cards) to avoid one network call per route.
 *
 * `Administrator` never has seeded `FeaturePermission` rows on the backend (it bypasses
 * the permission check entirely there), so `featurePermissions` comes back empty for it.
 * `hasFeatureAccess` mirrors that backend bypass explicitly.
 */
export function usePermissions() {
  const [role, setRole] = useState<string>("");
  const [featurePermissions, setFeaturePermissions] = useState<FeaturePermissionDto[]>([]);
  const [pagePermissions, setPagePermissions] = useState<PagePermissionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getMyPermissions()
      .then((res) => {
        if (!mounted) return;
        setRole(res.role);
        setFeaturePermissions(res.featurePermissions);
        setPagePermissions(res.pagePermissions);
        setError(null);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err);
        setRole("");
        setFeaturePermissions([]);
        setPagePermissions([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const hasFeatureAccess = (featureRoute: string): boolean => {
    if (role === "Administrator") return true;
    return featurePermissions.some((p) => p.featureRoute === featureRoute);
  };

  return { role, featurePermissions, pagePermissions, loading, error, hasFeatureAccess };
}
