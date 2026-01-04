import client from "../../../core/api/client";

export type AssistanceType = {
  id: number;
  name: string;
  points: number;
};

export async function getAssistanceTypes(): Promise<AssistanceType[]> {
  const resp = await client.get<AssistanceType[]>(
    "/api/catalog/assistancetypes"
  );
  return resp.data ?? [];
}

export default { getAssistanceTypes };
