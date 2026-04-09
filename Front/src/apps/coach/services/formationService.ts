import client from "../../../core/api/client";
import type { Formation } from "../types/formation";

export async function getFormations(): Promise<Formation[]> {
  const resp = await client.get("/api/catalog/formations");
  return resp.data as Formation[];
}

export default { getFormations };
