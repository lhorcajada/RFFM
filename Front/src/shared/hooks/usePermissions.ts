import { useEffect, useState } from "react";
import {
  getMyPermissions,
  type FeaturePermissionDto,
  type PagePermissionDto,
} from "../services/permissions/permissionService";

/**
 * Fetches the current user's full permission set once (roles + featurePermissions +
 * pagePermissions) and exposes a `hasFeatureAccess` helper. Prefer this hook over
 * `useFeaturePermission` when a page/component needs to check several feature routes
 * at once (e.g. a dashboard rendering many cards) to avoid one network call per route.
 *
 * The backend returns every role the user holds (a user can hold more than one, e.g.
 * "Federacion-xxx" and "Coach") and the combined `featurePermissions` across all of
 * them. `Administrator` never has seeded `FeaturePermission` rows on the backend (it
 * bypasses the permission check entirely there), so `hasFeatureAccess` mirrors that
 * bypass explicitly by checking whether `roles` includes "Administrator".
 */
export function usePermissions() {
  const [roles, setRoles] = useState<string[]>([]);
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
        setRoles(res.roles);
        setFeaturePermissions(res.featurePermissions);
        setPagePermissions(res.pagePermissions);
        setError(null);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err);
        setRoles([]);
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
    if (roles.includes("Administrator")) return true;
    return featurePermissions.some((p) => p.featureRoute === featureRoute);
  };

  return { roles, featurePermissions, pagePermissions, loading, error, hasFeatureAccess };
}
