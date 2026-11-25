import client from "../../../core/api/client";

export type LotteryCampaignSummary = {
  id: string;
  name: string;
  drawDate: string;
};

export type LotteryBookStatus =
  | "Unassigned"
  | "Assigned"
  | "DeliveredToPlayer"
  | "ReturnedToCoach"
  | "DeliveredToClub";

export type LotteryBook = {
  id: string;
  teamPlayerId: string | null;
  bookNumber: number;
  firstTicketNumber: number;
  lastTicketNumber: number;
  status: LotteryBookStatus;
  deliveredOn: string | null;
  returnedOn: string | null;
  amountReturned: number | null;
  clubDeliveredOn: string | null;
  ticketsSold: number | null;
  ticketsUnsold: number | null;
};

export type LotteryTotals = {
  booksDelivered: number;
  booksReturned: number;
  booksPending: number;
  ticketsDelivered: number;
  ticketsSold: number;
  ticketsUnsold: number;
  ticketsPending: number;
  amountCollected: number;
  amountPending: number;
};

export type LotteryClubDelivery = {
  booksDelivered: number;
  booksPending: number;
  amountDelivered: number;
  amountPending: number;
  lastDeliveredOn: string | null;
};

export type LotteryCampaign = {
  id: string;
  teamId: string;
  name: string;
  drawDate: string;
  ticketPrice: number;
  ticketsPerBook: number;
  clubDeliveryFrom: string;
  clubDeliveryTo: string;
  clubDelivery: LotteryClubDelivery;
  totals: LotteryTotals;
  books: LotteryBook[];
  canEdit: boolean;
};

export type LotteryCampaignRequest = {
  name: string;
  drawDate: string;
  ticketPrice: number;
  ticketsPerBook: number;
  clubDeliveryFrom: string;
  clubDeliveryTo: string;
};

export type CreateBooksRequest = {
  count: number;
};

export type AssignBookRequest = {
  bookId?: string;
  teamPlayerId: string;
  bookNumber: number;
  firstTicketNumber: number;
  lastTicketNumber: number;
};

export type UpdateBookRequest = {
  bookNumber: number;
  firstTicketNumber: number;
  lastTicketNumber: number;
};

export type AdvanceBookRequest = {
  date?: string;
  amount?: number;
};

const campaignsUrl = (teamId: string) => `/api/teams/${encodeURIComponent(teamId)}/lottery-campaigns`;
const campaignUrl = (teamId: string, campaignId: string) =>
  `${campaignsUrl(teamId)}/${encodeURIComponent(campaignId)}`;
const bookUrl = (teamId: string, campaignId: string, bookId: string) =>
  `${campaignUrl(teamId, campaignId)}/books/${encodeURIComponent(bookId)}`;

export async function getLotteryCampaigns(teamId: string): Promise<LotteryCampaignSummary[]> {
  const resp = await client.get<LotteryCampaignSummary[]>(campaignsUrl(teamId));
  return resp.data ?? [];
}

export async function getLotteryCampaign(teamId: string, campaignId: string): Promise<LotteryCampaign> {
  const resp = await client.get<LotteryCampaign>(campaignUrl(teamId, campaignId));
  return resp.data;
}

export async function createLotteryCampaign(teamId: string, body: LotteryCampaignRequest): Promise<LotteryCampaign> {
  const resp = await client.post<LotteryCampaign>(campaignsUrl(teamId), body);
  return resp.data;
}

export async function updateLotteryCampaign(
  teamId: string,
  campaignId: string,
  body: LotteryCampaignRequest,
): Promise<LotteryCampaign> {
  const resp = await client.put<LotteryCampaign>(campaignUrl(teamId, campaignId), body);
  return resp.data;
}

export async function deleteLotteryCampaign(teamId: string, campaignId: string): Promise<void> {
  await client.delete(campaignUrl(teamId, campaignId));
}

export async function createLotteryBooks(
  teamId: string,
  campaignId: string,
  body: CreateBooksRequest,
): Promise<LotteryCampaign> {
  const resp = await client.post<LotteryCampaign>(`${campaignUrl(teamId, campaignId)}/books/batch`, body);
  return resp.data;
}

export async function assignLotteryBook(
  teamId: string,
  campaignId: string,
  body: AssignBookRequest,
): Promise<LotteryCampaign> {
  const resp = await client.post<LotteryCampaign>(`${campaignUrl(teamId, campaignId)}/books`, body);
  return resp.data;
}

export async function updateLotteryBook(
  teamId: string,
  campaignId: string,
  bookId: string,
  body: UpdateBookRequest,
): Promise<LotteryCampaign> {
  const resp = await client.put<LotteryCampaign>(bookUrl(teamId, campaignId, bookId), body);
  return resp.data;
}

export async function deleteLotteryBook(teamId: string, campaignId: string, bookId: string): Promise<LotteryCampaign> {
  const resp = await client.delete<LotteryCampaign>(bookUrl(teamId, campaignId, bookId));
  return resp.data;
}

export async function advanceLotteryBookStatus(
  teamId: string,
  campaignId: string,
  bookId: string,
  body: AdvanceBookRequest,
): Promise<LotteryCampaign> {
  const resp = await client.put<LotteryCampaign>(`${bookUrl(teamId, campaignId, bookId)}/status`, body);
  return resp.data;
}

export async function undoLotteryBookStatus(
  teamId: string,
  campaignId: string,
  bookId: string,
): Promise<LotteryCampaign> {
  const resp = await client.delete<LotteryCampaign>(`${bookUrl(teamId, campaignId, bookId)}/status`);
  return resp.data;
}

export default {
  getLotteryCampaigns,
  getLotteryCampaign,
  createLotteryCampaign,
  updateLotteryCampaign,
  deleteLotteryCampaign,
  createLotteryBooks,
  assignLotteryBook,
  updateLotteryBook,
  deleteLotteryBook,
  advanceLotteryBookStatus,
  undoLotteryBookStatus,
};
