export type CountriesResponse = {
  id: string;
  name: string;
  code?: string;
};

export type ClubResponse = {
  id: string;
  name: string;
  country: CountriesResponse;
  emblemUrl?: string | null;
  invitationCode?: string | null;
};
