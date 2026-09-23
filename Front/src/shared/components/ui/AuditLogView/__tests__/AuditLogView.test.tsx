import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AuditLogView } from '../AuditLogView';
import * as auditLogService from '../../../../services/auditLogService';
import type { UserActivityLogResponse } from '../../../../services/auditLogService';

vi.mock('../../../../services/auditLogService');

function baseItem(overrides: Partial<UserActivityLogResponse> = {}): UserActivityLogResponse {
  return {
    id: 'log-1',
    userId: 'user-1',
    userName: 'user-1',
    roleName: 'Coach',
    roles: ['Coach'],
    clubId: null,
    clubName: null,
    teamId: 'team-1',
    teamName: null,
    linkedPlayerFullName: null,
    linkedPlayerAlias: null,
    timestamp: '2026-09-23T10:00:00Z',
    ipAddress: '127.0.0.1',
    eventType: 'PageAccess',
    actionOrPage: 'Dashboard',
    result: 'Success',
    reason: null,
    subjectId: null,
    ...overrides,
  };
}

describe('AuditLogView', () => {
  const mockSearchAuditLog = vi.mocked(auditLogService.searchAuditLog);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state while searchAuditLog is pending', async () => {
    mockSearchAuditLog.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ items: [], totalCount: 0 }), 100))
    );

    render(<AuditLogView />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders cards with event data once resolved', async () => {
    mockSearchAuditLog.mockResolvedValue({ items: [baseItem()], totalCount: 1 });

    render(<AuditLogView />);

    await waitFor(() => {
      expect(screen.getByText('Usuario: user-1')).toBeInTheDocument();
    });

    expect(screen.getByText('Acceso a página')).toBeInTheDocument();
    expect(screen.getByText('Roles: Coach')).toBeInTheDocument();
  });

  it('renders empty state when no results', async () => {
    mockSearchAuditLog.mockResolvedValue({ items: [], totalCount: 0 });

    render(<AuditLogView />);

    await waitFor(() => {
      expect(screen.getByText(/no hay eventos/i)).toBeInTheDocument();
    });
  });

  it('renders error state on search failure', async () => {
    mockSearchAuditLog.mockRejectedValue(new Error('Network error'));

    render(<AuditLogView />);

    await waitFor(() => {
      expect(screen.getByText(/error al cargar/i)).toBeInTheDocument();
    });
  });

  it('does not use table elements for layout', async () => {
    mockSearchAuditLog.mockResolvedValue({ items: [baseItem({ teamId: null, ipAddress: null })], totalCount: 1 });

    render(<AuditLogView />);

    await waitFor(() => {
      expect(screen.getByText('Usuario: user-1')).toBeInTheDocument();
    });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('includes fixed filters in search', async () => {
    mockSearchAuditLog.mockResolvedValue({ items: [], totalCount: 0 });

    render(<AuditLogView fixedFilters={{ clubId: 'club-1' }} />);

    await waitFor(() => {
      expect(mockSearchAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ clubId: 'club-1' })
      );
    });
  });

  it('displays event type in Spanish', async () => {
    mockSearchAuditLog.mockResolvedValue({
      items: [baseItem({
        teamId: null,
        ipAddress: null,
        eventType: 'ConvocationRejected',
        actionOrPage: 'ConvocationStatusChanged',
        reason: 'Lesión',
      })],
      totalCount: 1,
    });

    render(<AuditLogView />);

    await waitFor(() => {
      expect(screen.getByText('Convocatoria rechazada')).toBeInTheDocument();
    });
  });

  it('displays reason when present', async () => {
    mockSearchAuditLog.mockResolvedValue({
      items: [baseItem({
        teamId: null,
        ipAddress: null,
        eventType: 'PlayerEdited',
        actionOrPage: 'PlayerUpdate',
        reason: 'Profile updated',
        subjectId: 'player-1',
      })],
      totalCount: 1,
    });

    render(<AuditLogView />);

    await waitFor(() => {
      expect(screen.getByText('Usuario: user-1')).toBeInTheDocument();
    });

    expect(screen.getByText('Motivo: Profile updated')).toBeInTheDocument();
  });

  it('calls searchAuditLog with default pagination', async () => {
    mockSearchAuditLog.mockResolvedValue({ items: [], totalCount: 0 });

    render(<AuditLogView />);

    await waitFor(() => {
      expect(mockSearchAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ pageNumber: 1, pageSize: 25 })
      );
    });
  });

  it('displays all current roles of the user, not just the role at event time', async () => {
    mockSearchAuditLog.mockResolvedValue({
      items: [baseItem({ userName: 'carlos.entrenador', roleName: 'Coach', roles: ['Coach', 'ClubDirector'] })],
      totalCount: 1,
    });

    render(<AuditLogView />);

    await waitFor(() => {
      expect(screen.getByText('Usuario: carlos.entrenador')).toBeInTheDocument();
    });

    expect(screen.getByText('Roles: Coach, ClubDirector')).toBeInTheDocument();
  });

  it('displays linked player, team and club names when present', async () => {
    mockSearchAuditLog.mockResolvedValue({
      items: [baseItem({
        userName: 'familia.prueba',
        roleName: 'FamilyMember',
        roles: ['FamilyMember'],
        linkedPlayerFullName: 'Hijo DePrueba',
        teamName: 'Alevín A',
        clubName: 'CD Ejemplo',
      })],
      totalCount: 1,
    });

    render(<AuditLogView />);

    await waitFor(() => {
      expect(screen.getByText('Jugador: Hijo DePrueba')).toBeInTheDocument();
    });

    expect(screen.getByText('Equipo: Alevín A')).toBeInTheDocument();
    expect(screen.getByText('Club: CD Ejemplo')).toBeInTheDocument();
  });

  it('does not display player, team or club lines when not present', async () => {
    mockSearchAuditLog.mockResolvedValue({ items: [baseItem()], totalCount: 1 });

    render(<AuditLogView />);

    await waitFor(() => {
      expect(screen.getByText('Usuario: user-1')).toBeInTheDocument();
    });

    expect(screen.queryByText(/^Jugador:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Equipo:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Club:/)).not.toBeInTheDocument();
  });

  it('displays the linked player alias next to their full name', async () => {
    mockSearchAuditLog.mockResolvedValue({
      items: [baseItem({
        linkedPlayerFullName: 'Hijo DePrueba',
        linkedPlayerAlias: 'hijo10',
      })],
      totalCount: 1,
    });

    render(<AuditLogView />);

    await waitFor(() => {
      expect(screen.getByText('Jugador: Hijo DePrueba (hijo10)')).toBeInTheDocument();
    });
  });

  it('searches by free text (username, player alias, name or last name) instead of user id', async () => {
    mockSearchAuditLog.mockResolvedValue({ items: [], totalCount: 0 });

    render(<AuditLogView />);

    const searchInput = await screen.findByLabelText(/buscar/i);
    fireEvent.change(searchInput, { target: { value: 'carlos' } });

    await waitFor(() => {
      expect(mockSearchAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'carlos' })
      );
    });
  });
});
