import React from 'react';
import { useAuditPageAccess } from '../../../../shared/hooks/useAuditPageAccess';
import { AuditLogView } from '../../../../shared/components/ui/AuditLogView/AuditLogView';

/**
 * Coach app audit log page.
 * Shows the audit log filtered by the user's role/scope (Coach/ClubDirector).
 * Instruments page access for audit tracking.
 */
export function AuditLog(): React.ReactElement {
  useAuditPageAccess('AuditLog');

  return <AuditLogView />;
}

export default AuditLog;
