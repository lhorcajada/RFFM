import { useEffect, useRef } from 'react';
import { recordPageAccess } from '../services/auditLogService';

// Only sections that expose sensitive data or administration are audited; every other page is
// a plain read and would just add one INSERT + one request per visit.
const AUDITED_PAGES: ReadonlySet<string> = new Set([
  'AuditLog',
  'Settings',
  'TeamUsers',
  'SeasonAccess',
  'ClubManagement',
  'ClubPlayers',
  'ClubRegistrations',
  'PlayerDocuments',
  'MyDocuments',
  'Injured',
  'Sanctions',
]);

/**
 * Hook to record a page access event for audit logging.
 * Fires exactly once per unique pageIdentifier, using a ref guard to prevent
 * double-firing in React 19 dev mode. Pages outside AUDITED_PAGES are ignored.
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
    if (!pageIdentifier || !AUDITED_PAGES.has(pageIdentifier)) return;
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
