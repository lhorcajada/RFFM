import { client } from "../../../core/api/client";
import type {
  ValidateCodePayload,
  ValidateClubCodeResponse,
  ValidateTeamCodeResponse,
  PreviewClubCodeResponse,
  PreviewTeamCodeResponse,
} from "../../types/scope";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "1";

async function mockValidateClubCode(
  payload: ValidateCodePayload,
): Promise<ValidateClubCodeResponse> {
  await new Promise((r) => setTimeout(r, 250));
  return {
    clubId: "mock-club-1",
    clubName: "Mock FC",
    membershipKind: payload.membershipKind,
  };
}

async function mockValidateTeamCode(
  payload: ValidateCodePayload,
): Promise<ValidateTeamCodeResponse> {
  await new Promise((r) => setTimeout(r, 250));
  return {
    teamId: "mock-team-1",
    teamName: "Mock Team U12",
    clubId: "mock-club-1",
    membershipKind: payload.membershipKind,
  };
}

async function mockPreviewClubCode(
  payload: ValidateCodePayload,
): Promise<PreviewClubCodeResponse> {
  await new Promise((r) => setTimeout(r, 250));
  return {
    clubId: "mock-club-1",
    clubName: "Mock FC",
    membershipKind: payload.membershipKind as any,
  };
}

async function mockPreviewTeamCode(
  payload: ValidateCodePayload,
): Promise<PreviewTeamCodeResponse> {
  await new Promise((r) => setTimeout(r, 250));
  return {
    teamId: "mock-team-1",
    teamName: "Mock Team U12",
    clubId: "mock-club-1",
    membershipKind: payload.membershipKind as any,
    players: [
      {
        teamPlayerId: "mock-tp-1",
        playerId: "mock-p-1",
        name: "Jugador Mock",
        lastName: null,
        urlPhoto: null,
        dorsal: 10,
        alreadyLinked: false,
      },
    ],
  };
}

export class InvitationsApi {
  async validateClubCode(
    payload: ValidateCodePayload,
  ): Promise<ValidateClubCodeResponse> {
    if (USE_MOCK) {
      return mockValidateClubCode(payload);
    }
    const res = await client.post("/api/invitations/club/validate", payload);
    return res.data as ValidateClubCodeResponse;
  }

  async validateTeamCode(
    payload: ValidateCodePayload,
  ): Promise<ValidateTeamCodeResponse> {
    if (USE_MOCK) {
      return mockValidateTeamCode(payload);
    }
    const res = await client.post("/api/invitations/team/validate", payload);
    return res.data as ValidateTeamCodeResponse;
  }

  async previewClubCode(
    payload: ValidateCodePayload,
  ): Promise<PreviewClubCodeResponse> {
    if (USE_MOCK) {
      return mockPreviewClubCode(payload);
    }
    const res = await client.post("/api/invitations/club/preview", payload);
    return res.data as PreviewClubCodeResponse;
  }

  async previewTeamCode(
    payload: ValidateCodePayload,
  ): Promise<PreviewTeamCodeResponse> {
    if (USE_MOCK) {
      return mockPreviewTeamCode(payload);
    }
    const res = await client.post("/api/invitations/team/preview", payload);
    return res.data as PreviewTeamCodeResponse;
  }
}

export const invitationsApi = new InvitationsApi();
