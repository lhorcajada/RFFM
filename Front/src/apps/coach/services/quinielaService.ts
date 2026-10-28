import client from "../../../core/api/client";

export type QuinielaSign = "1" | "X" | "2";
export type QuinielaPaymentStatus = "Pending" | "Paid" | "Expired";
export type QuinielaPaymentMethod = "Cash" | "Bizum";
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

export type QuinielaTicket = {
  id: string;
  number: number;
  picks: QuinielaPick[];
  plenoHome: number;
  plenoAway: number;
  paymentStatus: QuinielaPaymentStatus;
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
  paymentMethod: QuinielaPaymentMethod | null;
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

export async function getQuinielaSettings(teamId: string): Promise<QuinielaSettings> {
  const resp = await client.get<QuinielaSettings>(`${quinielaUrl(teamId)}/settings`);
  return resp.data;
}

export async function updateQuinielaSettings(teamId: string, fundPercent: number): Promise<QuinielaSettings> {
  const resp = await client.put<QuinielaSettings>(`${quinielaUrl(teamId)}/settings`, { fundPercent });
  return resp.data;
}
