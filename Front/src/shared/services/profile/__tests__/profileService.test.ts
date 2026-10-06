import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.fn();
const mockPut = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();

vi.mock("../../../../core/api/client", () => ({
  client: {
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
    post: (...args: unknown[]) => mockPost(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

import {
  changePassword,
  deleteAvatar,
  getMyAccount,
  getMyMemberships,
  updatePersonalData,
  uploadAvatar,
} from "../profileService";

describe("profileService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("obtiene la cuenta del usuario", async () => {
    mockGet.mockResolvedValue({ data: { alias: "anag", email: "ana@example.com" } });

    const account = await getMyAccount();

    expect(mockGet).toHaveBeenCalledWith("/api/users/me/account");
    expect(account.alias).toBe("anag");
  });

  it("guarda los datos personales", async () => {
    mockPut.mockResolvedValue({ data: { alias: "anag", firstName: "Ana" } });
    const request = { firstName: "Ana", lastName: "García", secondLastName: null, phoneNumber: null };

    const account = await updatePersonalData(request);

    expect(mockPut).toHaveBeenCalledWith("/api/users/me/personal-data", request);
    expect(account.firstName).toBe("Ana");
  });

  it("sube la foto como multipart con el campo file", async () => {
    mockPost.mockResolvedValue({ data: { avatarUrl: "https://cdn/avatars/a.png" } });
    const file = new File(["x"], "foto.png", { type: "image/png" });

    const url = await uploadAvatar(file);

    const [path, body] = mockPost.mock.calls[0];
    expect(path).toBe("/api/users/me/avatar");
    expect((body as FormData).get("file")).toBe(file);
    expect(url).toBe("https://cdn/avatars/a.png");
  });

  it("quita la foto", async () => {
    mockDelete.mockResolvedValue({});

    await deleteAvatar();

    expect(mockDelete).toHaveBeenCalledWith("/api/users/me/avatar");
  });

  it("cambia la contraseña", async () => {
    mockPut.mockResolvedValue({});

    await changePassword({ currentPassword: "Antigua1!", newPassword: "Nueva123!" });

    expect(mockPut).toHaveBeenCalledWith("/api/users/me/password", {
      currentPassword: "Antigua1!",
      newPassword: "Nueva123!",
    });
  });

  it("obtiene las vinculaciones", async () => {
    mockGet.mockResolvedValue({ data: { clubs: [], teams: [] } });

    const memberships = await getMyMemberships();

    expect(mockGet).toHaveBeenCalledWith("/api/users/me/memberships");
    expect(memberships).toEqual({ clubs: [], teams: [] });
  });
});
