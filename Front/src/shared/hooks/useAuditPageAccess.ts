import { useEffect, useRef } from 'react';
import { recordPageAccess } from '../services/auditLogService';

/**
 * Hook to record a page access event for audit logging.
 * Fires exactly once per unique pageIdentifier, using a ref guard to prevent
 * double-firing in React 19 dev mode.
 *
 * @param pageIdentifier The page/section identifier (e.g., "Dashboard", "Squad")
 * @param options Optional clubId and teamId to include in the audit record
 */
export function useAuditPageAccess(
  pageIdentifier: string,
  options?: { clubId?: string; teamId?: string },
): void {
  const firedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pageIdentifier) return;
    if (firedForRef.current === pageIdentifier) return;

    firedForRef.current = pageIdentifier;
    void recordPageAccess({
      pageIdentifier,
      clubId: options?.clubId,
      teamId: options?.teamId,
    }).catch(() => {
      // Best-effort audit ping — never surface a failure to the user or block the page.
    });
  }, [pageIdentifier]); // clubId/teamId intentionally excluded: re-firing on every
                          // context resolution would defeat "once per section entry"
}
