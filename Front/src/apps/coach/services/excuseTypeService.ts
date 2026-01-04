import client from "../../../core/api/client";

export type ExcuseType = {
  id: number;
  name: string;
  justified?: boolean;
};

const LOCAL_OVERRIDES: ExcuseType[] = [
  { id: 1, name: "Injury", justified: true },
  { id: 2, name: "Study", justified: true },
  { id: 3, name: "Ill", justified: true },
  { id: 4, name: "Family Problem", justified: true },
  { id: 5, name: "Family Event", justified: false },
  { id: 6, name: "Birthday Event", justified: false },
];

export async function getExcuseTypes(): Promise<ExcuseType[]> {
  try {
    const resp = await client.get<ExcuseType[]>("/api/catalog/excusetypes");
    const server = resp.data ?? [];
    const map = new Map<number, ExcuseType>();
    LOCAL_OVERRIDES.forEach((e) => map.set(e.id, e));
    server.forEach((s) => {
      const existing = map.get(s.id);
      map.set(s.id, {
        id: s.id,
        name: s.name,
        justified: existing?.justified ?? s.justified,
      });
    });
    return Array.from(map.values());
  } catch (e) {
    return LOCAL_OVERRIDES;
  }
}

export default { getExcuseTypes };
