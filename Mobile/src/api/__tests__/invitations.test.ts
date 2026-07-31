import { previewClubCode, previewTeamCode } from '../invitations';

jest.mock('../client', () => ({
  api: {
    post: jest.fn(),
  },
}));

import { api } from '../client';

describe('previewClubCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls POST /api/invitations/club/preview with the payload and returns response.data', async () => {
    const payload = {
      code: 'CLUB123',
      membershipKind: 'ClubDirector',
    };

    const mockResponse = {
      data: {
        clubId: 'club-1',
        clubName: 'FC Barcelona',
        membershipKind: 'ClubDirector',
      },
    };

    (api.post as jest.Mock).mockResolvedValue(mockResponse);

    const result = await previewClubCode(payload);

    expect(api.post).toHaveBeenCalledWith('/api/invitations/club/preview', payload);
    expect(result).toEqual(mockResponse.data);
  });

  it('propagates rejection when the request fails', async () => {
    const payload = {
      code: 'INVALID',
      membershipKind: 'ClubDirector',
    };

    const mockError = {
      response: {
        data: {
          code: 'ClubInvitationCodeInvalid',
          detail: 'Invalid club code',
        },
      },
    };

    (api.post as jest.Mock).mockRejectedValue(mockError);

    await expect(previewClubCode(payload)).rejects.toEqual(mockError);
  });
});

describe('previewTeamCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls POST /api/invitations/team/preview with the payload and returns response.data', async () => {
    const payload = {
      code: 'TEAM123',
      membershipKind: 'Player',
    };

    const mockResponse = {
      data: {
        teamId: 'team-1',
        teamName: 'Barcelona B',
        clubId: 'club-1',
        membershipKind: 'Player',
        players: [
          {
            teamPlayerId: 'tp-1',
            playerId: 'p-1',
            name: 'John',
            lastName: 'Doe',
            urlPhoto: null,
            dorsal: 10,
            alreadyLinked: false,
          },
        ],
      },
    };

    (api.post as jest.Mock).mockResolvedValue(mockResponse);

    const result = await previewTeamCode(payload);

    expect(api.post).toHaveBeenCalledWith('/api/invitations/team/preview', payload);
    expect(result).toEqual(mockResponse.data);
  });

  it('propagates rejection when the request fails', async () => {
    const payload = {
      code: 'INVALID',
      membershipKind: 'Player',
    };

    const mockError = {
      response: {
        data: {
          code: 'TeamInvitationCodeInvalid',
          detail: 'Invalid team code',
        },
      },
    };

    (api.post as jest.Mock).mockRejectedValue(mockError);

    await expect(previewTeamCode(payload)).rejects.toEqual(mockError);
  });
});
