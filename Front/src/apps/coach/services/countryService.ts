import client from "../../../core/api/client";

export async function getCountries(): Promise<
  Array<{ id: number; name: string }>
> {
  const resp = await client.get("/api/catalog/countries");
  return resp.data ?? [];
}

export default { getCountries };
