import client from "../../../core/api/client";

export type TransactionType = "Sanction" | "Lottery" | "Quiniela" | "WalletTopUp" | "WalletCharge";

export type TransactionStatus = "Pending" | "Paid";

export type TeamTransaction = {
  id: string;
  type: TransactionType;
  personName?: string | null;
  amount: number;
  pendingAmount?: number | null;
  date?: string | null;
  description: string;
  status: TransactionStatus;
};

export type TransactionFilters = {
  status?: TransactionStatus;
  type?: TransactionType;
};

export async function getTeamTransactions(
  teamId: string,
  filters: TransactionFilters = {}
): Promise<TeamTransaction[]> {
  const resp = await client.get<TeamTransaction[]>(
    `/api/catalog/team/${encodeURIComponent(teamId)}/transactions`,
    { params: filters }
  );
  return resp.data;
}

export default { getTeamTransactions };
