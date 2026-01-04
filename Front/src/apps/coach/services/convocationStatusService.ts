import client from "../../../core/api/client";

export type ConvocationStatus = {
  id: number;
  name: string;
};

export async function getConvocationStatuses(): Promise<ConvocationStatus[]> {
  const resp = await client.get<ConvocationStatus[]>(
    "/api/catalog/convocationstatuses"
  );
  return resp.data ?? [];
}

export default { getConvocationStatuses };
