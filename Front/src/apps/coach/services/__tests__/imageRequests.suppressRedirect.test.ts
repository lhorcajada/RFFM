import { describe, it, expect, vi, beforeEach } from "vitest";

const get = vi.fn();
vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: { get: (...args: unknown[]) => get(...args) },
  client: { get: (...args: unknown[]) => get(...args) },
}));

import { fetchTeamPhoto } from "../teamService";
import { fetchPlayerPhoto } from "../playerService";
import { getClubEmblem } from "../clubService";

describe("imágenes opcionales: un fallo no debe llevar a la página de error", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ data: new Blob(["x"], { type: "image/png" }), headers: {} });
  });

  it("fetchTeamPhoto suprime la redirección de error", async () => {
    await fetchTeamPhoto("teams/foto.png");

    expect(get).toHaveBeenCalledWith(
      "/api/catalog/team/photo",
      expect.objectContaining({ responseType: "blob", suppressErrorRedirect: true }),
    );
  });

  it("fetchPlayerPhoto suprime la redirección de error", async () => {
    await fetchPlayerPhoto("players/foto.png");

    expect(get).toHaveBeenCalledWith(
      "/api/catalog/player/photo",
      expect.objectContaining({ responseType: "blob", suppressErrorRedirect: true }),
    );
  });

  it("getClubEmblem suprime la redirección de error", async () => {
    await getClubEmblem("club-1");

    expect(get).toHaveBeenCalledWith(
      "/api/catalog/club/club-1/emblem",
      expect.objectContaining({ responseType: "arraybuffer", suppressErrorRedirect: true }),
    );
  });
});
