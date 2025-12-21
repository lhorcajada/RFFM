import client from "../../../core/api/client";

export type DemarcationOption = {
  id: number;
  name: string;
  code?: string;
};

export async function getDemarcations(): Promise<DemarcationOption[]> {
  try {
    const resp = await client.get<DemarcationOption[]>(
      `/api/catalog/demarcations`
    );
    return resp.data ?? [];
  } catch (e) {
    return [];
  }
}

export default { getDemarcations };
