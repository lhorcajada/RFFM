import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuditPageAccess } from '../useAuditPageAccess';
import * as auditLogService from '../../services/auditLogService';

vi.mock('../../services/auditLogService');

describe('useAuditPageAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['Dashboard', 'Squad', 'Classification', 'Results', 'Quiniela', 'Notifications'])(
    'does not call recordPageAccess for the read-only page %s',
    (pageIdentifier) => {
      const mockRecordPageAccess = vi.fn().mockResolvedValue(undefined);
      vi.mocked(auditLogService.recordPageAccess).mockImplementation(mockRecordPageAccess);

      renderHook(() => useAuditPageAccess(pageIdentifier));

      expect(mockRecordPageAccess).not.toHaveBeenCalled();
    },
  );

  it.each(['AuditLog', 'Settings', 'TeamUsers', 'SeasonAccess', 'ClubRegistrations', 'PlayerDocuments', 'Injured'])(
    'calls recordPageAccess for the sensitive page %s',
    (pageIdentifier) => {
      const mockRecordPageAccess = vi.fn().mockResolvedValue(undefined);
      vi.mocked(auditLogService.recordPageAccess).mockImplementation(mockRecordPageAccess);

      renderHook(() => useAuditPageAccess(pageIdentifier));

      expect(mockRecordPageAccess).toHaveBeenCalledOnce();
    },
  );

  it('calls recordPageAccess on mount with the provided pageIdentifier', () => {
    const mockRecordPageAccess = vi.fn().mockResolvedValue(undefined);
    vi.mocked(auditLogService.recordPageAccess).mockImplementation(mockRecordPageAccess);

    renderHook(() => useAuditPageAccess('Settings'));

    expect(mockRecordPageAccess).toHaveBeenCalledOnce();
    expect(mockRecordPageAccess).toHaveBeenCalledWith({ pageIdentifier: 'Settings' });
  });

  it('does not call recordPageAccess again on re-render with the same pageIdentifier', () => {
    const mockRecordPageAccess = vi.fn().mockResolvedValue(undefined);
    vi.mocked(auditLogService.recordPageAccess).mockImplementation(mockRecordPageAccess);

    const { rerender } = renderHook(
      ({ pageId }: { pageId: string }) => useAuditPageAccess(pageId),
      { initialProps: { pageId: 'Settings' } },
    );

    expect(mockRecordPageAccess).toHaveBeenCalledTimes(1);

    rerender({ pageId: 'Settings' });

    expect(mockRecordPageAccess).toHaveBeenCalledTimes(1);
  });

  it('calls recordPageAccess again if pageIdentifier changes', () => {
    const mockRecordPageAccess = vi.fn().mockResolvedValue(undefined);
    vi.mocked(auditLogService.recordPageAccess).mockImplementation(mockRecordPageAccess);

    const { rerender } = renderHook(
      ({ pageId }: { pageId: string }) => useAuditPageAccess(pageId),
      { initialProps: { pageId: 'Settings' } },
    );

    expect(mockRecordPageAccess).toHaveBeenCalledTimes(1);
    expect(mockRecordPageAccess).toHaveBeenLastCalledWith({ pageIdentifier: 'Settings' });

    rerender({ pageId: 'TeamUsers' });

    expect(mockRecordPageAccess).toHaveBeenCalledTimes(2);
    expect(mockRecordPageAccess).toHaveBeenLastCalledWith({ pageIdentifier: 'TeamUsers' });
  });

  it('swallows rejection errors and does not propagate them', async () => {
    const mockRecordPageAccess = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.mocked(auditLogService.recordPageAccess).mockImplementation(mockRecordPageAccess);

    expect(() => {
      renderHook(() => useAuditPageAccess('Settings'));
    }).not.toThrow();
  });

  it('does not call recordPageAccess when pageIdentifier is empty string', () => {
    const mockRecordPageAccess = vi.fn().mockResolvedValue(undefined);
    vi.mocked(auditLogService.recordPageAccess).mockImplementation(mockRecordPageAccess);

    renderHook(() => useAuditPageAccess(''));

    expect(mockRecordPageAccess).not.toHaveBeenCalled();
  });

  it('includes clubId and teamId in the request when provided', () => {
    const mockRecordPageAccess = vi.fn().mockResolvedValue(undefined);
    vi.mocked(auditLogService.recordPageAccess).mockImplementation(mockRecordPageAccess);

    renderHook(() => useAuditPageAccess('TeamUsers', { clubId: 'club-1', teamId: 'team-1' }));

    expect(mockRecordPageAccess).toHaveBeenCalledWith({
      pageIdentifier: 'TeamUsers',
      clubId: 'club-1',
      teamId: 'team-1',
    });
  });
});
