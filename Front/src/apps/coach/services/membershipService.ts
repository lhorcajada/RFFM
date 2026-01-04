import client from "../../../core/api/client";

export type MembershipResponse = {
  id: number;
  key: string;
  name: string;
};

export async function getMemberships(): Promise<MembershipResponse[]> {
  const resp = await client.get<MembershipResponse[]>(
    "/api/catalog/memberships"
  );
  return resp.data ?? [];
}

export default { getMemberships };
