import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import client from "../../../../core/api/client";
import {
  getInjuryProtocol,
  updateInjuryProtocol,
  deleteInjuryProtocol,
  uploadInjuryProtocolAttachment,
  deleteInjuryProtocolAttachment,
} from "../injuryProtocolService";
import type { InjuryProtocolResponse, InjuryProtocolAttachment } from "../injuryProtocolService";

describe("injuryProtocolService", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("getInjuryProtocol", () => {
    it("consulta el protocolo de lesiones del equipo y devuelve su contenido y adjuntos", async () => {
      const response: InjuryProtocolResponse = {
        teamId: "team-1",
        content: "<p>Protocolo</p>",
        updatedAt: "2026-01-01T00:00:00Z",
        attachments: [
          {
            id: "att-1",
            fileName: "protocolo.pdf",
            url: "https://storage/protocolo.pdf",
            uploadedAt: "2026-01-01T00:00:00Z",
          },
        ],
      };
      (client.get as any).mockResolvedValue({ data: response });

      const res = await getInjuryProtocol("team-1");

      expect(client.get).toHaveBeenCalledWith("/api/catalog/team/team-1/injury-protocol");
      expect(res).toEqual(response);
    });

    it("devuelve null si la petición falla", async () => {
      (client.get as any).mockRejectedValue(new Error("network error"));

      const res = await getInjuryProtocol("team-1");

      expect(res).toBeNull();
    });
  });

  describe("updateInjuryProtocol", () => {
    it("envía el contenido nuevo mediante PUT y devuelve el protocolo actualizado", async () => {
      const response: InjuryProtocolResponse = {
        teamId: "team-1",
        content: "<p>Nuevo contenido</p>",
        updatedAt: "2026-01-02T00:00:00Z",
        attachments: [],
      };
      (client.put as any).mockResolvedValue({ data: response });

      const res = await updateInjuryProtocol("team-1", "<p>Nuevo contenido</p>");

      expect(client.put).toHaveBeenCalledWith(
        "/api/catalog/team/team-1/injury-protocol",
        { content: "<p>Nuevo contenido</p>" }
      );
      expect(res).toEqual(response);
    });

    it("propaga el error si la petición falla", async () => {
      (client.put as any).mockRejectedValue(new Error("400"));

      await expect(updateInjuryProtocol("team-1", "")).rejects.toThrow();
    });
  });

  describe("deleteInjuryProtocol", () => {
    it("elimina el contenido del protocolo mediante DELETE", async () => {
      (client.delete as any).mockResolvedValue({ status: 204 });

      await deleteInjuryProtocol("team-1");

      expect(client.delete).toHaveBeenCalledWith("/api/catalog/team/team-1/injury-protocol");
    });

    it("propaga el error si la petición falla", async () => {
      (client.delete as any).mockRejectedValue(new Error("403"));

      await expect(deleteInjuryProtocol("team-1")).rejects.toThrow();
    });
  });

  describe("uploadInjuryProtocolAttachment", () => {
    it("sube el fichero como FormData y devuelve el adjunto creado", async () => {
      const attachment: InjuryProtocolAttachment = {
        id: "att-2",
        fileName: "hoja.pdf",
        url: "https://storage/hoja.pdf",
        uploadedAt: "2026-01-03T00:00:00Z",
      };
      (client.post as any).mockResolvedValue({ data: attachment });
      const file = new File(["contenido"], "hoja.pdf", { type: "application/pdf" });

      const res = await uploadInjuryProtocolAttachment("team-1", file);

      expect(client.post).toHaveBeenCalledWith(
        "/api/catalog/team/team-1/injury-protocol/attachments",
        expect.any(FormData),
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const sentForm = (client.post as any).mock.calls[0][1] as FormData;
      const sentFile = sentForm.get("file") as File;
      expect(sentFile.name).toBe("hoja.pdf");
      expect(res).toEqual(attachment);
    });

    it("propaga el error si la subida falla", async () => {
      (client.post as any).mockRejectedValue(new Error("400"));
      const file = new File(["x"], "x.pdf", { type: "application/pdf" });

      await expect(uploadInjuryProtocolAttachment("team-1", file)).rejects.toThrow();
    });
  });

  describe("deleteInjuryProtocolAttachment", () => {
    it("elimina un adjunto concreto mediante DELETE", async () => {
      (client.delete as any).mockResolvedValue({ status: 204 });

      await deleteInjuryProtocolAttachment("team-1", "att-1");

      expect(client.delete).toHaveBeenCalledWith(
        "/api/catalog/team/team-1/injury-protocol/attachments/att-1"
      );
    });

    it("propaga el error si la petición falla", async () => {
      (client.delete as any).mockRejectedValue(new Error("404"));

      await expect(deleteInjuryProtocolAttachment("team-1", "att-1")).rejects.toThrow();
    });
  });
});
