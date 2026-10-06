import { client } from "../../../core/api/client";

export type MyAccount = {
  alias: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  secondLastName: string | null;
  phoneNumber: string | null;
  avatarUrl: string | null;
};

export type UpdatePersonalDataRequest = {
  firstName: string;
  lastName: string;
  secondLastName: string | null;
  phoneNumber: string | null;
};

export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

export type MembershipRole =
  | "Directive"
  | "Coach"
  | "ClubMember"
  | "Player"
  | "FamilyPlayer"
  | "Follower";

export type ClubMembership = {
  clubId: string;
  clubName: string;
  role: MembershipRole;
};

export type TeamMembership = {
  teamId: string;
  teamName: string;
  clubId: string;
  clubName: string;
  role: MembershipRole;
  linkedPlayerName: string | null;
};

export type MyMemberships = {
  clubs: ClubMembership[];
  teams: TeamMembership[];
};

export async function getMyAccount(): Promise<MyAccount> {
  const res = await client.get<MyAccount>("/api/users/me/account");
  return res.data;
}

export async function updatePersonalData(request: UpdatePersonalDataRequest): Promise<MyAccount> {
  const res = await client.put<MyAccount>("/api/users/me/personal-data", request);
  return res.data;
}

export async function uploadAvatar(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await client.post<{ avatarUrl: string }>("/api/users/me/avatar", form);
  return res.data.avatarUrl;
}

export async function deleteAvatar(): Promise<void> {
  await client.delete("/api/users/me/avatar");
}

export async function changePassword(request: ChangePasswordRequest): Promise<void> {
  await client.put("/api/users/me/password", request);
}

export async function getMyMemberships(): Promise<MyMemberships> {
  const res = await client.get<MyMemberships>("/api/users/me/memberships");
  return res.data;
}
