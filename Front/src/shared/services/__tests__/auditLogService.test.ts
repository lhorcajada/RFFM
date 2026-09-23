import { describe, it, expect, beforeEach, vi } from 'vitest';
import { client } from '../../../core/api/client';
import * as auditLogService from '../auditLogService';

vi.mock('../../../core/api/client');

describe('auditLogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordPageAccess', () => {
    it('posts to /api/audit-log/page-access with the exact request shape', async () => {
      const mockPost = vi.fn().mockResolvedValue({ status: 200 });
      (client.post as any) = mockPost;

      await auditLogService.recordPageAccess({
        pageIdentifier: 'Dashboard',
        clubId: 'club-1',
        teamId: 'team-1',
      });

      expect(mockPost).toHaveBeenCalledOnce();
      const [url, data] = mockPost.mock.calls[0];
      expect(url).toBe('/api/audit-log/page-access');
      expect(data).toEqual({
        pageIdentifier: 'Dashboard',
        clubId: 'club-1',
        teamId: 'team-1',
      });
    });

    it('posts with undefined optional fields omitted from request', async () => {
      const mockPost = vi.fn().mockResolvedValue({ status: 200 });
      (client.post as any) = mockPost;

      await auditLogService.recordPageAccess({
        pageIdentifier: 'Dashboard',
      });

      expect(mockPost).toHaveBeenCalledOnce();
      const [url, data] = mockPost.mock.calls[0];
      expect(data).toEqual({
        pageIdentifier: 'Dashboard',
      });
    });
  });

  describe('searchAuditLog', () => {
    it('gets /api/audit-log with query params and parses X-Total-Count header', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        status: 200,
        data: [
          {
            id: 'log-1',
            userId: 'user-1',
            roleName: 'Coach',
            clubId: null,
            teamId: 'team-1',
            timestamp: '2026-09-23T10:00:00Z',
            ipAddress: '127.0.0.1',
            eventType: 'PageAccess',
            actionOrPage: 'Dashboard',
            result: 'Success',
            reason: null,
            subjectId: null,
          },
        ],
        headers: {
          'x-total-count': '42',
        },
      });
      (client.get as any) = mockGet;

      const result = await auditLogService.searchAuditLog({
        pageNumber: 1,
        pageSize: 25,
        eventType: 'PageAccess',
      });

      expect(mockGet).toHaveBeenCalledOnce();
      const [url, config] = mockGet.mock.calls[0];
      expect(url).toBe('/api/audit-log');
      expect(config.params).toEqual({
        pageNumber: 1,
        pageSize: 25,
        eventType: 'PageAccess',
      });
      expect(result.totalCount).toBe(42);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('log-1');
    });

    it('omits undefined optional params from query string', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        status: 200,
        data: [],
        headers: { 'x-total-count': '0' },
      });
      (client.get as any) = mockGet;

      await auditLogService.searchAuditLog({
        pageNumber: 1,
        pageSize: 25,
      });

      const [, config] = mockGet.mock.calls[0];
      expect(config.params).toEqual({
        pageNumber: 1,
        pageSize: 25,
      });
      expect(config.params.clubId).toBeUndefined();
      expect(config.params.teamId).toBeUndefined();
      expect(config.params.userId).toBeUndefined();
      expect(config.params.eventType).toBeUndefined();
    });

    it('defaults totalCount to 0 if X-Total-Count header is missing', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        status: 200,
        data: [],
        headers: {},
      });
      (client.get as any) = mockGet;

      const result = await auditLogService.searchAuditLog({ pageNumber: 1, pageSize: 25 });

      expect(result.totalCount).toBe(0);
    });
  });
});
