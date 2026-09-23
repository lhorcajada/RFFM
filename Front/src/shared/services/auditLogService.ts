import { client } from '../../core/api/client';

export type AuditEventType =
  | 'PageAccess'
  | 'ConvocationAccepted'
  | 'ConvocationRejected'
  | 'PlayerEdited';

export type RecordPageAccessRequest = {
  pageIdentifier: string;
  clubId?: string;
  teamId?: string;
};

export type AuditLogSearchParams = {
  pageNumber?: number;
  pageSize?: number;
  clubId?: string;
  teamId?: string;
  userId?: string;
  /** Matches by username, or by the linked player's name/last name/alias. */
  search?: string;
  eventType?: AuditEventType;
  from?: string; // ISO 8601 UTC
  to?: string;   // ISO 8601 UTC
};

export type UserActivityLogResponse = {
  id: string;
  userId: string;
  userName: string;
  roleName: string;
  roles: string[];
  clubId: string | null;
  clubName: string | null;
  teamId: string | null;
  teamName: string | null;
  linkedPlayerFullName: string | null;
  linkedPlayerAlias: string | null;
  timestamp: string;
  ipAddress: string | null;
  eventType: AuditEventType;
  actionOrPage: string;
  result: 'Success' | 'Failure';
  reason: string | null;
  subjectId: string | null;
};

export type AuditLogSearchResult = {
  items: UserActivityLogResponse[];
  totalCount: number;
};

/**
 * Records a page access event for audit logging.
 * Fire-and-forget: errors are swallowed and never surfaced to the user.
 */
export async function recordPageAccess(request: RecordPageAccessRequest): Promise<void> {
  const body: RecordPageAccessRequest = {
    pageIdentifier: request.pageIdentifier,
  };
  if (request.clubId !== undefined) {
    body.clubId = request.clubId;
  }
  if (request.teamId !== undefined) {
    body.teamId = request.teamId;
  }
  await client.post('/api/audit-log/page-access', body);
}

/**
 * Searches the audit log with optional filters.
 * Parses the X-Total-Count header to determine total count.
 */
export async function searchAuditLog(params: AuditLogSearchParams): Promise<AuditLogSearchResult> {
  const queryParams: Record<string, any> = {};

  if (params.pageNumber !== undefined) {
    queryParams.pageNumber = params.pageNumber;
  }
  if (params.pageSize !== undefined) {
    queryParams.pageSize = params.pageSize;
  }
  if (params.clubId !== undefined) {
    queryParams.clubId = params.clubId;
  }
  if (params.teamId !== undefined) {
    queryParams.teamId = params.teamId;
  }
  if (params.userId !== undefined) {
    queryParams.userId = params.userId;
  }
  if (params.search !== undefined) {
    queryParams.search = params.search;
  }
  if (params.eventType !== undefined) {
    queryParams.eventType = params.eventType;
  }
  if (params.from !== undefined) {
    queryParams.from = params.from;
  }
  if (params.to !== undefined) {
    queryParams.to = params.to;
  }

  const response = await client.get('/api/audit-log', {
    params: queryParams,
  });

  const totalCount = parseInt(response.headers['x-total-count'] ?? '0', 10) || 0;

  return {
    items: response.data,
    totalCount,
  };
}
