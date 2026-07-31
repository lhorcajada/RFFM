import { registerAccount } from '../register';

jest.mock('../client', () => ({
  api: {
    post: jest.fn(),
  },
}));

import { api } from '../client';

describe('registerAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls POST /api/register with the payload and returns response.data', async () => {
    const payload = {
      email: 'test@example.com',
      alias: 'testuser',
      password: 'password123',
      accountType: 'Fan',
    };

    const mockResponse = {
      data: {
        userId: '123',
        roles: ['Fan'],
        status: 'Active' as const,
        subscription: null,
        clubJoinRequestId: null,
      },
    };

    (api.post as jest.Mock).mockResolvedValue(mockResponse);

    const result = await registerAccount(payload);

    expect(api.post).toHaveBeenCalledWith('/api/register', payload);
    expect(result).toEqual(mockResponse.data);
  });

  it('normalizes a numeric status of 0 (backend enum ordinal) to "Active"', async () => {
    const payload = {
      email: 'test@example.com',
      alias: 'testuser',
      password: 'password123',
      accountType: 'Fan',
    };

    (api.post as jest.Mock).mockResolvedValue({
      data: {
        userId: '123',
        roles: ['Fan'],
        status: 0,
        subscription: null,
        clubJoinRequestId: null,
      },
    });

    const result = await registerAccount(payload);

    expect(result.status).toBe('Active');
  });

  it('normalizes a numeric status of 1 (backend enum ordinal) to "PendingClubApproval"', async () => {
    const payload = {
      email: 'test@example.com',
      alias: 'testuser',
      password: 'password123',
      accountType: 'ClubDirector',
    };

    (api.post as jest.Mock).mockResolvedValue({
      data: {
        userId: '123',
        roles: ['ClubDirector'],
        status: 1,
        subscription: null,
        clubJoinRequestId: 'request-1',
      },
    });

    const result = await registerAccount(payload);

    expect(result.status).toBe('PendingClubApproval');
  });

  it('propagates rejection when the request fails', async () => {
    const payload = {
      email: 'test@example.com',
      alias: 'testuser',
      password: 'password123',
      accountType: 'Fan',
    };

    const mockError = {
      response: {
        data: {
          code: 'EmailIsAlreadyTaken',
          detail: 'Email already registered',
        },
      },
    };

    (api.post as jest.Mock).mockRejectedValue(mockError);

    await expect(registerAccount(payload)).rejects.toEqual(mockError);
  });
});
