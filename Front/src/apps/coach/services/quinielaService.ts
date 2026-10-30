import client from "../../../core/api/client";

export type QuinielaSign = "1" | "X" | "2";
export type QuinielaPaymentStatus = "Pending" | "Paid" | "Expired";
export type QuinielaPaymentMethod = "Cash" | "Bizum";
export type QuinielaTicketPaymentMethod = QuinielaPaymentMethod | "Wallet";
export type QuinielaCategory = "None" | "Special" | "First" | "Second" | "Third";

export type QuinielaJornada = {
  id: string;
  teamId: string;
  rffmRoundId: string;
  roundNumber: number;
  roundName: string;
  price: number;
  status: "Open" | "Settled";
  carryIn: number;
  firstKickoffUtc: string | null;
  paymentDeadlineUtc: string | null;
  picksClosed: boolean;
};

export type QuinielaMatch = {
  recordCode: string;
  homeTeam: string;
  awayTeam: string;
  kickoffUtc: string | null;
  isValid: boolean;
  isPleno: boolean;
  homeGoals: number | null;
  awayGoals: number | null;
  isFinal: boolean;
};

export type QuinielaPick = {
  recordCode: string;
  sign: QuinielaSign;
};

export type QuinielaWalletCharge = {
  amount: number;
  balanceAfter: number;
};

export type QuinielaTicket = {
  id: string;
  number: number;
  picks: QuinielaPick[];
  plenoHome: number;
  plenoAway: number;
  paymentStatus: QuinielaPaymentStatus;
  paymentMethod?: QuinielaTicketPaymentMethod | null;
  walletCharge?: QuinielaWalletCharge | null;
  paymentDeadlineUtc: string | null;
  hits: number | null;
  category: QuinielaCategory | null;
  prize: number | null;
};

export type QuinielaPool = {
  participants: number;
  paidTickets: number;
  collected: number;
  prizePool: number;
  possiblePrizePool: number;
};

export type QuinielaWinner = {
  userName: string;
  category: QuinielaCategory;
  hits: number;
  prize: number;
  ticketNumber: number;
};

export type QuinielaPrevious = {
  jornadaId: string;
  roundNumber: number;
  settledAt: string;
  carryOut: number;
  myHits: number | null;
  myCategory: QuinielaCategory | null;
  myPrize: number | null;
  winners: QuinielaWinner[];
};

export type QuinielaCurrent = {
  isOpen: boolean;
  jornada: QuinielaJornada | null;
  matches: QuinielaMatch[];
  myTickets: QuinielaTicket[];
  pool: QuinielaPool | null;
  previous: QuinielaPrevious | null;
  canManage: boolean;
};

export type SaveQuinielaTicketRequest = {
  picks: QuinielaPick[];
  plenoHome: number;
  plenoAway: number;
};

export type QuinielaPaymentTicket = {
  id: string;
  number: number;
  userId: string;
  userName: string;
  role: string;
  paymentStatus: QuinielaPaymentStatus;
  paymentMethod: QuinielaTicketPaymentMethod | null;
  paidAt: string | null;
  hits: number | null;
  category: QuinielaCategory | null;
  prize: number | null;
  picks: QuinielaPick[];
  plenoHome: number;
  plenoAway: number;
};

export type QuinielaTotals = {
  collected: number;
  pending: number;
  prizePool: number;
  fundAmount: number;
  carryIn: number;
  carryOut: number | null;
  prizes: number;
  prizePercent: number;
  possiblePrizePool: number;
};

export type QuinielaSettings = {
  fundPercent: number;
};

export type QuinielaFundMovement = {
  id: string;
  amount: number;
  occurredAt: string;
  description: string | null;
};

export type QuinielaPayments = {
  jornada: QuinielaJornada;
  tickets: QuinielaPaymentTicket[];
  totals: QuinielaTotals;
  movements: QuinielaFundMovement[];
  matches: QuinielaMatch[];
};

export type SetQuinielaPaymentRequest = {
  paid: boolean;
  method?: QuinielaPaymentMethod | null;
};

export type QuinielaTicketResult = {
  ticketId: string;
  hits: number;
  category: QuinielaCategory;
  prize: number;
};

export type QuinielaSettlement = {
  collected: number;
  prizePool: number;
  fundAmount: number;
  carryOut: number;
  tickets: QuinielaTicketResult[];
};

export type QuinielaWalletMovementType = "TopUp" | "Adjustment" | "TicketCharge" | "TicketRefund";

export type QuinielaWalletMovement = {
  id: string;
  type: QuinielaWalletMovementType;
  amount: number;
  occurredAt: string;
  description: string | null;
  ticketId: string | null;
};

export type QuinielaWallet = {
  userId: string;
  userName: string;
  role: string;
  balance: number;
  totalMovements: number;
  movements: QuinielaWalletMovement[];
};

export type QuinielaWalletSummary = {
  userId: string;
  userName: string;
  role: string;
  balance: number;
};

export type QuinielaWalletOperation = {
  userId: string;
  balance: number;
  movement: QuinielaWalletMovement;
};

export type QuinielaWalletPage = {
  limit?: number;
  offset?: number;
};

export type TopUpQuinielaWalletRequest = {
  amount: number;
  description?: string;
};

export type AdjustQuinielaWalletRequest = {
  amount: number;
  reason: string;
};

const quinielaUrl = (teamId: string) => `/api/teams/${encodeURIComponent(teamId)}/quiniela`;
const jornadaUrl = (teamId: string, jornadaId: string) => `${quinielaUrl(teamId)}/${encodeURIComponent(jornadaId)}`;

export async function getCurrentQuiniela(teamId: string): Promise<QuinielaCurrent> {
  const resp = await client.get<QuinielaCurrent>(`${quinielaUrl(teamId)}/current`);
  return resp.data;
}

export async function openQuiniela(teamId: string): Promise<QuinielaJornada> {
  const resp = await client.post<QuinielaJornada>(quinielaUrl(teamId));
  return resp.data;
}

export async function saveQuinielaTicket(
  teamId: string,
  jornadaId: string,
  body: SaveQuinielaTicketRequest,
  ticketId?: string,
): Promise<QuinielaTicket> {
  const url = `${jornadaUrl(teamId, jornadaId)}/my-tickets`;
  const resp = ticketId
    ? await client.put<QuinielaTicket>(`${url}/${encodeURIComponent(ticketId)}`, body)
    : await client.post<QuinielaTicket>(url, body);
  return resp.data;
}

export async function getQuinielaPayments(teamId: string, jornadaId: string): Promise<QuinielaPayments> {
  const resp = await client.get<QuinielaPayments>(`${jornadaUrl(teamId, jornadaId)}/payments`);
  return resp.data;
}

export async function setQuinielaTicketPayment(
  teamId: string,
  jornadaId: string,
  ticketId: string,
  body: SetQuinielaPaymentRequest,
): Promise<QuinielaPaymentTicket> {
  const resp = await client.put<QuinielaPaymentTicket>(
    `${jornadaUrl(teamId, jornadaId)}/tickets/${encodeURIComponent(ticketId)}/payment`,
    body,
  );
  return resp.data;
}

export async function settleQuiniela(teamId: string, jornadaId: string): Promise<QuinielaSettlement> {
  const resp = await client.post<QuinielaSettlement>(`${jornadaUrl(teamId, jornadaId)}/settle`);
  return resp.data;
}

export async function deleteQuinielaTicket(teamId: string, jornadaId: string, ticketId: string): Promise<void> {
  await client.delete(`${jornadaUrl(teamId, jornadaId)}/tickets/${encodeURIComponent(ticketId)}`);
}

export async function deleteMyQuinielaTicket(teamId: string, jornadaId: string, ticketId: string): Promise<void> {
  await client.delete(`${jornadaUrl(teamId, jornadaId)}/my-tickets/${encodeURIComponent(ticketId)}`);
}

export async function resetQuiniela(teamId: string, jornadaId: string): Promise<void> {
  await client.delete(jornadaUrl(teamId, jornadaId));
}

const walletPageParams = ({ limit = 25, offset = 0 }: QuinielaWalletPage) => ({ params: { limit, offset } });

export async function getMyQuinielaWallet(teamId: string, page: QuinielaWalletPage = {}): Promise<QuinielaWallet> {
  const resp = await client.get<QuinielaWallet>(`${quinielaUrl(teamId)}/wallet`, walletPageParams(page));
  return resp.data;
}

export async function getQuinielaWalletOf(
  teamId: string,
  userId: string,
  page: QuinielaWalletPage = {},
): Promise<QuinielaWallet> {
  const resp = await client.get<QuinielaWallet>(
    `${quinielaUrl(teamId)}/wallets/${encodeURIComponent(userId)}`,
    walletPageParams(page),
  );
  return resp.data;
}

export async function getQuinielaWallets(teamId: string): Promise<QuinielaWalletSummary[]> {
  const resp = await client.get<QuinielaWalletSummary[]>(`${quinielaUrl(teamId)}/wallets`);
  return resp.data;
}

export async function topUpQuinielaWallet(
  teamId: string,
  userId: string,
  body: TopUpQuinielaWalletRequest,
): Promise<QuinielaWalletOperation> {
  const resp = await client.post<QuinielaWalletOperation>(
    `${quinielaUrl(teamId)}/wallets/${encodeURIComponent(userId)}/top-ups`,
    body,
  );
  return resp.data;
}

export async function adjustQuinielaWallet(
  teamId: string,
  userId: string,
  body: AdjustQuinielaWalletRequest,
): Promise<QuinielaWalletOperation> {
  const resp = await client.post<QuinielaWalletOperation>(
    `${quinielaUrl(teamId)}/wallets/${encodeURIComponent(userId)}/adjustments`,
    body,
  );
  return resp.data;
}

export async function payQuinielaTicketWithWallet(
  teamId: string,
  jornadaId: string,
  ticketId: string,
): Promise<QuinielaTicket> {
  const resp = await client.post<QuinielaTicket>(
    `${jornadaUrl(teamId, jornadaId)}/my-tickets/${encodeURIComponent(ticketId)}/wallet-payment`,
  );
  return resp.data;
}

export async function getQuinielaSettings(teamId: string): Promise<QuinielaSettings> {
  const resp = await client.get<QuinielaSettings>(`${quinielaUrl(teamId)}/settings`);
  return resp.data;
}

export async function updateQuinielaSettings(teamId: string, fundPercent: number): Promise<QuinielaSettings> {
  const resp = await client.put<QuinielaSettings>(`${quinielaUrl(teamId)}/settings`, { fundPercent });
  return resp.data;
}
