import client from "../../../core/api/client";

export type DocumentTypeResponse = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

export type PlayerDocumentStatus = "Pending" | "Delivered" | "Approved" | "Rejected";

export type PlayerDocumentResponse = {
  documentTypeId: string;
  documentTypeName: string;
  teamPlayerId: string;
  status: PlayerDocumentStatus;
  fileName: string | null;
  url: string | null;
  contentType: string | null;
  uploadedAt: string | null;
  uploadedOnBehalf: boolean | null;
  reviewedAt: string | null;
  reviewNote: string | null;
};

export type TeamPlayerDocumentStatusResponse = {
  teamPlayerId: string;
  playerId: string;
  playerName: string;
  dorsal: number | null;
  status: PlayerDocumentStatus;
  uploadedAt: string | null;
  reviewedAt: string | null;
};

export async function getDocumentTypes(): Promise<DocumentTypeResponse[]> {
  const resp = await client.get<DocumentTypeResponse[]>("/api/catalog/document-types");
  return resp.data ?? [];
}

export async function getPlayerDocuments(teamPlayerId: string): Promise<PlayerDocumentResponse[]> {
  const resp = await client.get<PlayerDocumentResponse[]>(
    `/api/catalog/teamplayer/${encodeURIComponent(teamPlayerId)}/documents`
  );
  return resp.data ?? [];
}

export async function getTeamDocumentsStatus(
  teamId: string,
  documentTypeId: string
): Promise<TeamPlayerDocumentStatusResponse[]> {
  const resp = await client.get<TeamPlayerDocumentStatusResponse[]>(
    `/api/catalog/team/${encodeURIComponent(teamId)}/documents`,
    { params: { documentTypeId } }
  );
  return resp.data ?? [];
}

export async function uploadPlayerDocument(
  teamPlayerId: string,
  documentTypeId: string,
  file: File
): Promise<PlayerDocumentResponse> {
  const form = new FormData();
  form.append("file", file, file.name);
  const resp = await client.post<PlayerDocumentResponse>(
    `/api/catalog/teamplayer/${encodeURIComponent(teamPlayerId)}/documents/${encodeURIComponent(documentTypeId)}`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } } as any
  );
  return resp.data;
}

export async function deletePlayerDocument(
  teamPlayerId: string,
  documentTypeId: string
): Promise<void> {
  await client.delete(
    `/api/catalog/teamplayer/${encodeURIComponent(teamPlayerId)}/documents/${encodeURIComponent(documentTypeId)}`
  );
}

export async function reviewPlayerDocument(
  teamPlayerId: string,
  documentTypeId: string,
  approve: boolean,
  note: string | null
): Promise<PlayerDocumentResponse> {
  const resp = await client.patch<PlayerDocumentResponse>(
    `/api/catalog/teamplayer/${encodeURIComponent(teamPlayerId)}/documents/${encodeURIComponent(documentTypeId)}/review`,
    { approve, note }
  );
  return resp.data;
}

export async function downloadTeamDocumentsReport(
  teamId: string,
  documentTypeId: string
): Promise<Blob> {
  const resp = await client.get(`/api/catalog/team/${encodeURIComponent(teamId)}/documents/report`, {
    params: { documentTypeId },
    responseType: "blob",
  });
  return resp.data as Blob;
}

export type ErrorMessage = {
  message: string;
  severity: "error" | "warning";
};

export function mapPlayerDocumentError(code: string | undefined): ErrorMessage {
  const errorMap: Record<string, ErrorMessage> = {
    DocumentTypeNotFound: {
      message: "El tipo de documento no existe.",
      severity: "error",
    },
    TeamPlayerNotFound: {
      message: "No se encontró al jugador.",
      severity: "error",
    },
    PlayerDocumentAccessForbidden: {
      message: "No tienes permiso para acceder a este documento.",
      severity: "error",
    },
    PlayerDocumentInvalidFile: {
      message: "Archivo no válido. Debe ser un PDF, JPG o PNG.",
      severity: "warning",
    },
    PlayerDocumentFileTooLarge: {
      message: "El archivo supera el tamaño máximo permitido (10 MB).",
      severity: "warning",
    },
    PlayerDocumentNotFound: {
      message: "Todavía no se ha entregado ningún documento.",
      severity: "warning",
    },
    PlayerDocumentNotDelivered: {
      message:
        "Este documento no está pendiente de revisión (puede que se haya vuelto a subir). Actualiza la página.",
      severity: "warning",
    },
  };

  return (
    errorMap[code ?? ""] ?? {
      message: "Ha ocurrido un error. Inténtalo de nuevo.",
      severity: "error",
    }
  );
}

export default {
  getDocumentTypes,
  getPlayerDocuments,
  getTeamDocumentsStatus,
  uploadPlayerDocument,
  deletePlayerDocument,
  reviewPlayerDocument,
  downloadTeamDocumentsReport,
  mapPlayerDocumentError,
};
