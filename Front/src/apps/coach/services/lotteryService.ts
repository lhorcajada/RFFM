import client from "../../../core/api/client";

export type LotteryCampaignSummary = {
  id: string;
  name: string;
  drawDate: string;
};

export type LotteryBook = {
  id: string;
  teamPlayerId: string;
  bookNumber: number;
  firstTicketNumber: number;
  lastTicketNumber: number;
  deliveredOn: string;
  returnedOn: string | null;
  amountReturned: number | null;
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

export type LotteryCampaign = {
  id: string;
  teamId: string;
  name: string;
  drawDate: string;
  ticketPrice: number;
  ticketsPerBook: number;
  clubDeliveryFrom: string;
  clubDeliveryTo: string;
  clubDeliveredOn: string | null;
  clubDeliveredAmount: number | null;
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

export type DeliverBookRequest = {
  teamPlayerId: string;
  bookNumber: number;
  firstTicketNumber: number;
  deliveredOn?: string;
};

export type UpdateBookRequest = {
  teamPlayerId: string;
  bookNumber: number;
  firstTicketNumber: number;
  deliveredOn: string;
};

export type ReturnBookRequest = {
  amount: number;
  returnedOn?: string;
};

export type ClubDeliveryRequest = {
  amount: number;
  deliveredOn?: string;
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

export async function deliverLotteryBook(
  teamId: string,
  campaignId: string,
  body: DeliverBookRequest,
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

export async function returnLotteryBook(
  teamId: string,
  campaignId: string,
  bookId: string,
  body: ReturnBookRequest,
): Promise<LotteryCampaign> {
  const resp = await client.put<LotteryCampaign>(`${bookUrl(teamId, campaignId, bookId)}/return`, body);
  return resp.data;
}

export async function undoLotteryBookReturn(
  teamId: string,
  campaignId: string,
  bookId: string,
): Promise<LotteryCampaign> {
  const resp = await client.delete<LotteryCampaign>(`${bookUrl(teamId, campaignId, bookId)}/return`);
  return resp.data;
}

export async function recordLotteryClubDelivery(
  teamId: string,
  campaignId: string,
  body: ClubDeliveryRequest,
): Promise<LotteryCampaign> {
  const resp = await client.put<LotteryCampaign>(`${campaignUrl(teamId, campaignId)}/club-delivery`, body);
  return resp.data;
}

export async function undoLotteryClubDelivery(teamId: string, campaignId: string): Promise<LotteryCampaign> {
  const resp = await client.delete<LotteryCampaign>(`${campaignUrl(teamId, campaignId)}/club-delivery`);
  return resp.data;
}

export default {
  getLotteryCampaigns,
  getLotteryCampaign,
  createLotteryCampaign,
  updateLotteryCampaign,
  deleteLotteryCampaign,
  deliverLotteryBook,
  updateLotteryBook,
  deleteLotteryBook,
  returnLotteryBook,
  undoLotteryBookReturn,
  recordLotteryClubDelivery,
  undoLotteryClubDelivery,
};
