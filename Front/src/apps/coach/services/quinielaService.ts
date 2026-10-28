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
};

export type QuinielaPrevious = {
  jornadaId: string;
  roundNumber: number;
  settledAt: string;
  carryOut: number;
  myHits: number | null;
  myCategory: QuinielaCategory | null;
  myPrize: number | null;
};

export type QuinielaCurrent = {
  isOpen: boolean;
  jornada: QuinielaJornada | null;
  matches: QuinielaMatch[];
  myTicket: QuinielaTicket | null;
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
  userId: string;
  userName: string;
  role: string;
  paymentStatus: QuinielaPaymentStatus;
  paymentMethod: QuinielaPaymentMethod | null;
  paidAt: string | null;
  hits: number | null;
  category: QuinielaCategory | null;
  prize: number | null;
};

export type QuinielaTotals = {
  collected: number;
  pending: number;
  prizePool: number;
  fundAmount: number;
  carryIn: number;
  carryOut: number | null;
  prizes: number;
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
): Promise<QuinielaTicket> {
  const resp = await client.put<QuinielaTicket>(`${jornadaUrl(teamId, jornadaId)}/ticket`, body);
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
