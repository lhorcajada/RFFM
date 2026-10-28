import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QUINIELA_LAUNCH_DATE,
  currentUserId,
  isQuinielaNovelty,
  markQuinielaSeen,
} from "../quinielaNovelty";

const DAY = 24 * 60 * 60 * 1000;
const launch = new Date(QUINIELA_LAUNCH_DATE).getTime();

describe("quinielaNovelty", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("es novedad dentro de los 14 días desde el lanzamiento si no se ha abierto", () => {
    expect(isQuinielaNovelty("u1", "t1", new Date(launch + 3 * DAY))).toBe(true);
  });

  it("deja de ser novedad pasados 14 días desde el lanzamiento", () => {
    expect(isQuinielaNovelty("u1", "t1", new Date(launch + 15 * DAY))).toBe(false);
  });

  it("deja de ser novedad tras marcar la quiniela como vista", () => {
    markQuinielaSeen("u1", "t1");
    expect(isQuinielaNovelty("u1", "t1", new Date(launch + 1 * DAY))).toBe(false);
  });

  it("lo visto se guarda por usuario y equipo", () => {
    markQuinielaSeen("u1", "t1");
    expect(isQuinielaNovelty("u2", "t1", new Date(launch + 1 * DAY))).toBe(true);
    expect(isQuinielaNovelty("u1", "t2", new Date(launch + 1 * DAY))).toBe(true);
  });

  it("sin almacenamiento depende solo de la fecha y no lanza", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => markQuinielaSeen("u1", "t1")).not.toThrow();
    expect(isQuinielaNovelty("u1", "t1", new Date(launch + 1 * DAY))).toBe(true);
    expect(isQuinielaNovelty("u1", "t1", new Date(launch + 20 * DAY))).toBe(false);
  });

  it("obtiene el id del usuario guardado o null", () => {
    expect(currentUserId()).toBeNull();
    localStorage.setItem("rffm_user", JSON.stringify({ id: "u9", username: "x" }));
    expect(currentUserId()).toBe("u9");
  });
});
