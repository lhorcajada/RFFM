export type UserClubsResponse = {
  clubId: string;
  clubName: string;
  shieldUrl: string;
  role: string;
  roleId: number;
  isCreator: boolean;
};

export type UserClubsApiResponse = UserClubsResponse[];
