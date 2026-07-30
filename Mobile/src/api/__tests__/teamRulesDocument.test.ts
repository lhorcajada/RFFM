import { api } from '../client';
import { getTeamRulesDocument, uploadTeamRulesDocument } from '../teamRulesDocument';

jest.mock('../client', () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));

const mockFileInstance = {
  exists: false,
  create: jest.fn(),
  delete: jest.fn(),
  write: jest.fn(),
  uri: 'file:///cache/team-rules-team1.pdf',
};

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => mockFileInstance),
  Paths: { cache: 'mock-cache-dir' },
}));

const mockApi = api as jest.Mocked<typeof api>;

describe('teamRulesDocument api client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileInstance.exists = false;
  });

  describe('getTeamRulesDocument', () => {
    it('returns null when the backend responds with 204 (no document uploaded)', async () => {
      (mockApi.get as jest.Mock).mockResolvedValue({ status: 204, data: null });

      const result = await getTeamRulesDocument('team1');

      expect(result).toBeNull();
      expect(mockApi.get).toHaveBeenCalledWith(
        '/api/mobile/teams/team1/rules-document',
        expect.objectContaining({ responseType: 'arraybuffer' }),
      );
    });

    it('writes the response bytes to a local cache file and returns its uri when the document exists', async () => {
      const arrayBuffer = new Uint8Array([1, 2, 3]).buffer;
      (mockApi.get as jest.Mock).mockResolvedValue({ status: 200, data: arrayBuffer });

      const result = await getTeamRulesDocument('team1');

      expect(mockFileInstance.create).toHaveBeenCalled();
      expect(mockFileInstance.write).toHaveBeenCalled();
      expect(result).toEqual({ localUri: 'file:///cache/team-rules-team1.pdf' });
    });

    it('deletes a previously cached file before writing the new one', async () => {
      mockFileInstance.exists = true;
      const arrayBuffer = new Uint8Array([1, 2, 3]).buffer;
      (mockApi.get as jest.Mock).mockResolvedValue({ status: 200, data: arrayBuffer });

      await getTeamRulesDocument('team1');

      expect(mockFileInstance.delete).toHaveBeenCalled();
    });

    it('propagates errors from the API call', async () => {
      (mockApi.get as jest.Mock).mockRejectedValue(new Error('network error'));

      await expect(getTeamRulesDocument('team1')).rejects.toThrow('network error');
    });
  });

  describe('uploadTeamRulesDocument', () => {
    it('posts a multipart form with the PDF and returns the upload result', async () => {
      (mockApi.post as jest.Mock).mockResolvedValue({
        data: { url: 'https://storage/team-rules/team1.pdf', uploadedAt: '2026-07-30T10:00:00Z' },
      });

      const result = await uploadTeamRulesDocument('team1', 'file:///picked/rules.pdf', 'rules.pdf');

      expect(mockApi.post).toHaveBeenCalledWith(
        '/api/mobile/teams/team1/rules-document',
        expect.any(FormData),
        expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } }),
      );
      expect(result).toEqual({ url: 'https://storage/team-rules/team1.pdf', uploadedAt: '2026-07-30T10:00:00Z' });
    });

    it('propagates errors from the upload request', async () => {
      (mockApi.post as jest.Mock).mockRejectedValue(new Error('upload failed'));

      await expect(uploadTeamRulesDocument('team1', 'file:///picked/rules.pdf', 'rules.pdf')).rejects.toThrow(
        'upload failed',
      );
    });
  });
});
