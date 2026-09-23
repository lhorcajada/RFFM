import React from 'react';
import { useAuditPageAccess } from '../../../../shared/hooks/useAuditPageAccess';
import { AuditLogView } from '../../../../shared/components/ui/AuditLogView/AuditLogView';

/**
 * Federation app audit log page.
 * Shows the audit log for Federation-role users (unfiltered view).
 * Instruments page access for audit tracking.
 */
export function AuditLog(): React.ReactElement {
  useAuditPageAccess('AuditLog');

  return <AuditLogView />;
}

export default AuditLog;
