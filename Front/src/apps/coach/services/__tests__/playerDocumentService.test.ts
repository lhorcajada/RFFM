import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock("../../../../core/api/client", () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

import {
  getDocumentTypes,
  getPlayerDocuments,
  getTeamDocumentsStatus,
  uploadPlayerDocument,
  deletePlayerDocument,
  reviewPlayerDocument,
  downloadTeamDocumentsReport,
  mapPlayerDocumentError,
  type DocumentTypeResponse,
  type PlayerDocumentResponse,
  type TeamPlayerDocumentStatusResponse,
} from "../playerDocumentService";

describe("playerDocumentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDocumentTypes", () => {
    it("calls GET /api/catalog/document-types and returns the array", async () => {
      const mockTypes: DocumentTypeResponse[] = [
        { id: "dt1", name: "Document 1", description: "Desc 1", isActive: true },
        { id: "dt2", name: "Document 2", description: null, isActive: false },
      ];
      mockGet.mockResolvedValue({ data: mockTypes });

      const result = await getDocumentTypes();

      expect(mockGet).toHaveBeenCalledWith("/api/catalog/document-types");
      expect(result).toEqual(mockTypes);
    });
  });

  describe("getPlayerDocuments", () => {
    it("calls GET /api/catalog/teamplayer/{teamPlayerId}/documents", async () => {
      const mockDocs: PlayerDocumentResponse[] = [
        {
          documentTypeId: "dt1",
          documentTypeName: "Authorization",
          teamPlayerId: "tp1",
          status: "Pending",
          fileName: null,
          url: null,
          contentType: null,
          uploadedAt: null,
          uploadedOnBehalf: null,
          reviewedAt: null,
          reviewNote: null,
        },
      ];
      mockGet.mockResolvedValue({ data: mockDocs });

      const result = await getPlayerDocuments("tp1");

      expect(mockGet).toHaveBeenCalledWith("/api/catalog/teamplayer/tp1/documents");
      expect(result).toEqual(mockDocs);
    });
  });

  describe("getTeamDocumentsStatus", () => {
    it("calls GET /api/catalog/team/{teamId}/documents with documentTypeId param and no seasonId", async () => {
      const mockStatus: TeamPlayerDocumentStatusResponse[] = [
        {
          teamPlayerId: "tp1",
          playerId: "p1",
          playerName: "John Doe",
          dorsal: 10,
          status: "Delivered",
          uploadedAt: "2026-09-17T08:00:00Z",
          reviewedAt: null,
        },
      ];
      mockGet.mockResolvedValue({ data: mockStatus });

      const result = await getTeamDocumentsStatus("t1", "dt1");

      expect(mockGet).toHaveBeenCalledWith("/api/catalog/team/t1/documents", {
        params: { documentTypeId: "dt1" },
      });
      // Verify no seasonId in params
      const callArgs = mockGet.mock.calls[0];
      expect(callArgs[1]?.params?.seasonId).toBeUndefined();
      expect(result).toEqual(mockStatus);
    });
  });

  describe("uploadPlayerDocument", () => {
    it("builds FormData with file field and POSTs to the endpoint", async () => {
      const mockResponse: PlayerDocumentResponse = {
        documentTypeId: "dt1",
        documentTypeName: "Authorization",
        teamPlayerId: "tp1",
        status: "Delivered",
        fileName: "auth.pdf",
        url: "http://example.com/auth.pdf",
        contentType: "application/pdf",
        uploadedAt: "2026-09-17T08:00:00Z",
        uploadedOnBehalf: false,
        reviewedAt: null,
        reviewNote: null,
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      const file = new File(["content"], "auth.pdf", { type: "application/pdf" });
      const appendSpy = vi.spyOn(FormData.prototype, "append");

      const result = await uploadPlayerDocument("tp1", "dt1", file);

      // Verify POST was called with the correct URL
      expect(mockPost).toHaveBeenCalled();
      const [url] = mockPost.mock.calls[0];
      expect(url).toBe("/api/catalog/teamplayer/tp1/documents/dt1");

      // Verify FormData.append was called with the file
      expect(appendSpy).toHaveBeenCalledWith("file", file, file.name);

      expect(result).toEqual(mockResponse);

      appendSpy.mockRestore();
    });
  });

  describe("deletePlayerDocument", () => {
    it("calls DELETE on the document endpoint", async () => {
      mockDelete.mockResolvedValue({});

      await deletePlayerDocument("tp1", "dt1");

      expect(mockDelete).toHaveBeenCalledWith("/api/catalog/teamplayer/tp1/documents/dt1");
    });
  });

  describe("reviewPlayerDocument", () => {
    it("PATCHes to the review endpoint with approve and note", async () => {
      const mockResponse: PlayerDocumentResponse = {
        documentTypeId: "dt1",
        documentTypeName: "Authorization",
        teamPlayerId: "tp1",
        status: "Approved",
        fileName: "auth.pdf",
        url: "http://example.com/auth.pdf",
        contentType: "application/pdf",
        uploadedAt: "2026-09-17T08:00:00Z",
        uploadedOnBehalf: false,
        reviewedAt: "2026-09-17T09:00:00Z",
        reviewNote: null,
      };
      mockPatch.mockResolvedValue({ data: mockResponse });

      const result = await reviewPlayerDocument("tp1", "dt1", true, null);

      expect(mockPatch).toHaveBeenCalledWith(
        "/api/catalog/teamplayer/tp1/documents/dt1/review",
        { approve: true, note: null }
      );
      expect(result).toEqual(mockResponse);
    });

    it("PATCHes with reject and a note message", async () => {
      const mockResponse: PlayerDocumentResponse = {
        documentTypeId: "dt1",
        documentTypeName: "Authorization",
        teamPlayerId: "tp1",
        status: "Rejected",
        fileName: "auth.pdf",
        url: "http://example.com/auth.pdf",
        contentType: "application/pdf",
        uploadedAt: "2026-09-17T08:00:00Z",
        uploadedOnBehalf: false,
        reviewedAt: "2026-09-17T09:00:00Z",
        reviewNote: "Not clear enough",
      };
      mockPatch.mockResolvedValue({ data: mockResponse });

      const result = await reviewPlayerDocument("tp1", "dt1", false, "Not clear enough");

      expect(mockPatch).toHaveBeenCalledWith(
        "/api/catalog/teamplayer/tp1/documents/dt1/review",
        { approve: false, note: "Not clear enough" }
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe("downloadTeamDocumentsReport", () => {
    it("GETs the report endpoint with documentTypeId param and responseType blob, no seasonId", async () => {
      const mockBlob = new Blob(["report"], { type: "application/pdf" });
      mockGet.mockResolvedValue({ data: mockBlob });

      const result = await downloadTeamDocumentsReport("t1", "dt1");

      expect(mockGet).toHaveBeenCalledWith("/api/catalog/team/t1/documents/report", {
        params: { documentTypeId: "dt1" },
        responseType: "blob",
      });
      // Verify no seasonId in params
      const callArgs = mockGet.mock.calls[0];
      expect(callArgs[1]?.params?.seasonId).toBeUndefined();
      expect(result).toBe(mockBlob);
    });
  });

  describe("mapPlayerDocumentError", () => {
    it("maps DocumentTypeNotFound to error severity", () => {
      const result = mapPlayerDocumentError("DocumentTypeNotFound");
      expect(result.message).toBe("El tipo de documento no existe.");
      expect(result.severity).toBe("error");
    });

    it("maps TeamPlayerNotFound to error severity", () => {
      const result = mapPlayerDocumentError("TeamPlayerNotFound");
      expect(result.message).toBe("No se encontró al jugador.");
      expect(result.severity).toBe("error");
    });

    it("maps PlayerDocumentAccessForbidden to error severity", () => {
      const result = mapPlayerDocumentError("PlayerDocumentAccessForbidden");
      expect(result.message).toBe("No tienes permiso para acceder a este documento.");
      expect(result.severity).toBe("error");
    });

    it("maps PlayerDocumentInvalidFile to warning severity", () => {
      const result = mapPlayerDocumentError("PlayerDocumentInvalidFile");
      expect(result.message).toBe("Archivo no válido. Debe ser un PDF, JPG o PNG.");
      expect(result.severity).toBe("warning");
    });

    it("maps PlayerDocumentFileTooLarge to warning severity", () => {
      const result = mapPlayerDocumentError("PlayerDocumentFileTooLarge");
      expect(result.message).toBe("El archivo supera el tamaño máximo permitido (10 MB).");
      expect(result.severity).toBe("warning");
    });

    it("maps PlayerDocumentNotFound to warning severity", () => {
      const result = mapPlayerDocumentError("PlayerDocumentNotFound");
      expect(result.message).toBe("Todavía no se ha entregado ningún documento.");
      expect(result.severity).toBe("warning");
    });

    it("maps PlayerDocumentNotDelivered to warning severity", () => {
      const result = mapPlayerDocumentError("PlayerDocumentNotDelivered");
      expect(result.message).toBe(
        "Este documento no está pendiente de revisión (puede que se haya vuelto a subir). Actualiza la página."
      );
      expect(result.severity).toBe("warning");
    });

    it("returns error for undefined/unknown codes", () => {
      const result = mapPlayerDocumentError(undefined);
      expect(result.message).toBe("Ha ocurrido un error. Inténtalo de nuevo.");
      expect(result.severity).toBe("error");
    });

    it("returns error for unknown code", () => {
      const result = mapPlayerDocumentError("UnknownCode");
      expect(result.message).toBe("Ha ocurrido un error. Inténtalo de nuevo.");
      expect(result.severity).toBe("error");
    });
  });
});
