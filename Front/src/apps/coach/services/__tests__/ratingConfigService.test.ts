import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

import client from "../../../../core/api/client";
import {
  createCapacity,
  createTrait,
  getRatingConfig,
  setCapacityVisibility,
  setTraitVisibility,
  updateCapacity,
  updateTrait,
} from "../ratingConfigService";

const base = "/api/catalog/team/team-1/rating-config";
const mockGet = client.get as ReturnType<typeof vi.fn>;
const mockPost = client.post as ReturnType<typeof vi.fn>;
const mockPut = client.put as ReturnType<typeof vi.fn>;

describe("ratingConfigService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("lee la configuración del equipo", async () => {
    const config = { capacities: [], traits: [] };
    mockGet.mockResolvedValue({ data: config });

    expect(await getRatingConfig("team-1")).toEqual(config);
    expect(client.get).toHaveBeenCalledWith(base);
  });

  it("crea un rasgo", async () => {
    const trait = { key: "custom-1" };
    mockPost.mockResolvedValue({ data: trait });
    const payload = { label: "Juego aéreo", phase: "withBall" as const, anchor1: "Nunca", anchor3: "A veces", anchor5: "Siempre" };

    expect(await createTrait("team-1", payload)).toEqual(trait);
    expect(client.post).toHaveBeenCalledWith(`${base}/traits`, payload);
  });

  it("edita un rasgo", async () => {
    mockPut.mockResolvedValue({ data: { key: "traitPressing" } });

    await updateTrait("team-1", "traitPressing", { label: "Presiona alto" });

    expect(client.put).toHaveBeenCalledWith(`${base}/traits/traitPressing`, { label: "Presiona alto" });
  });

  it("oculta y restaura un rasgo", async () => {
    mockPut.mockResolvedValue({ data: {} });

    await setTraitVisibility("team-1", "traitDuels", true);

    expect(client.put).toHaveBeenCalledWith(`${base}/traits/traitDuels/visibility`, { hidden: true });
  });

  it("crea una capacidad", async () => {
    mockPost.mockResolvedValue({ data: { key: "custom-2" } });
    const payload = { sheet: "field" as const, categoryKey: "technical" as const, label: "Juego aéreo ofensivo", levelTexts: ["a", "b"] };

    await createCapacity("team-1", payload);

    expect(client.post).toHaveBeenCalledWith(`${base}/capacities`, payload);
  });

  it("edita una capacidad por defecto enviando su hoja y su categoría", async () => {
    mockPut.mockResolvedValue({ data: {} });

    await updateCapacity("team-1", "technicalDribbling", { label: "Regate en corto", sheet: "field", categoryKey: "technical" });

    expect(client.put).toHaveBeenCalledWith(`${base}/capacities/technicalDribbling`, {
      label: "Regate en corto",
      sheet: "field",
      categoryKey: "technical",
    });
  });

  it("oculta una capacidad enviando su hoja y su categoría", async () => {
    mockPut.mockResolvedValue({ data: {} });

    await setCapacityVisibility("team-1", "physicalSpeed", true, { sheet: "field", categoryKey: "physical" });

    expect(client.put).toHaveBeenCalledWith(`${base}/capacities/physicalSpeed/visibility`, {
      hidden: true,
      sheet: "field",
      categoryKey: "physical",
    });
  });

  it("codifica la clave en la URL", async () => {
    mockPut.mockResolvedValue({ data: {} });

    await setTraitVisibility("team-1", "a b", false);

    expect(client.put).toHaveBeenCalledWith(`${base}/traits/a%20b/visibility`, { hidden: false });
  });
});
