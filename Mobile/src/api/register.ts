import { api } from './client';

export type RegistrationStatus = 'Active' | 'PendingClubApproval';

export interface RegisterAccountPayload {
  alias: string;
  email: string;
  password: string;
  accountType: string;
  trialAccepted?: boolean;
  clubInvitationCode?: string;
  teamInvitationCode?: string;
  teamPlayerId?: string;
}

export interface RegisterAccountResponse {
  userId: string;
  roles: string[];
  status: RegistrationStatus;
  subscription: { plan: string; status: string; endDate: string } | null;
  clubJoinRequestId: string | null;
}

const STATUS_BY_ORDINAL: RegistrationStatus[] = ['Active', 'PendingClubApproval'];

function normalizeStatus(status: RegistrationStatus | number): RegistrationStatus {
  return typeof status === 'number' ? STATUS_BY_ORDINAL[status] : status;
}

export const registerAccount = async (
  payload: RegisterAccountPayload,
): Promise<RegisterAccountResponse> => {
  const response = await api.post('/api/register', payload);
  return { ...response.data, status: normalizeStatus(response.data.status) };
};
