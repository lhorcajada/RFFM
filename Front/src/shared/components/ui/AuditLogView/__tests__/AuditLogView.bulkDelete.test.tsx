import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { AuditLogView } from '../AuditLogView';
import * as auditLogService from '../../../../services/auditLogService';
import type { UserActivityLogResponse } from '../../../../services/auditLogService';
import { coachAuthService } from '../../../../../apps/coach/services/authService';

vi.mock('../../../../services/auditLogService');
vi.mock('../../../../../apps/coach/services/authService', () => ({
  coachAuthService: { hasRole: vi.fn(() => false) },
}));

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

const twoItems = [
  baseItem({ id: 'log-1', userName: 'ana' }),
  baseItem({ id: 'log-2', userName: 'luis' }),
];

function grantRoles(...granted: string[]) {
  vi.mocked(coachAuthService.hasRole).mockImplementation((role: string) => granted.includes(role));
}

function selectionCheckboxes() {
  return screen.getAllByRole('checkbox', { name: 'Seleccionar evento' });
}

describe('AuditLogView bulk delete', () => {
  const mockSearchAuditLog = vi.mocked(auditLogService.searchAuditLog);
  const mockDelete = vi.mocked(auditLogService.deleteAuditLogEntries);

  beforeEach(() => {
    vi.clearAllMocks();
    grantRoles();
  });

  describe('permission', () => {
    it('sin permiso no muestra checkboxes ni barra de selección', async () => {
      mockSearchAuditLog.mockResolvedValue({ items: twoItems, totalCount: 2 });

      render(<AuditLogView />);

      await waitFor(() => expect(screen.getByText('Usuario: ana')).toBeInTheDocument());
      expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
      expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();
    });

    it('con rol Federation muestra un checkbox por evento', async () => {
      grantRoles('Federation');
      mockSearchAuditLog.mockResolvedValue({ items: twoItems, totalCount: 2 });

      render(<AuditLogView />);

      await waitFor(() => expect(selectionCheckboxes()).toHaveLength(2));
    });
  });

  describe('selection', () => {
    beforeEach(() => {
      grantRoles('Federation');
      mockSearchAuditLog.mockResolvedValue({ items: twoItems, totalCount: 2 });
    });

    it('«Seleccionar página» marca todas las tarjetas y muestra el contador', async () => {
      render(<AuditLogView />);
      await waitFor(() => expect(selectionCheckboxes()).toHaveLength(2));

      fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar página' }));

      expect(screen.getByText('2 seleccionados')).toBeInTheDocument();
      selectionCheckboxes().forEach(checkbox => expect(checkbox).toBeChecked());
    });

    it('«Eliminar» está deshabilitado cuando no hay ningún evento seleccionado', async () => {
      render(<AuditLogView />);
      await waitFor(() => expect(selectionCheckboxes()).toHaveLength(2));

      expect(screen.getByRole('button', { name: /eliminar/i })).toBeDisabled();
    });

    it('cambiar de página vacía la selección', async () => {
      mockSearchAuditLog.mockResolvedValue({
        items: twoItems,
        totalCount: 60,
      });
      render(<AuditLogView />);
      await waitFor(() => expect(selectionCheckboxes()).toHaveLength(2));
      fireEvent.click(selectionCheckboxes()[0]);
      expect(screen.getByText('1 seleccionado')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /go to page 2/i }));

      await waitFor(() => expect(screen.queryByText('1 seleccionado')).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: /eliminar/i })).toBeDisabled();
    });

    it('cambiar un filtro vacía la selección', async () => {
      render(<AuditLogView />);
      await waitFor(() => expect(selectionCheckboxes()).toHaveLength(2));
      fireEvent.click(selectionCheckboxes()[0]);

      fireEvent.change(await screen.findByLabelText(/buscar/i), { target: { value: 'ana' } });

      await waitFor(() => expect(screen.queryByText('1 seleccionado')).not.toBeInTheDocument());
    });
  });

  describe('confirmed deletion', () => {
    beforeEach(() => {
      grantRoles('Federation');
      mockSearchAuditLog.mockResolvedValue({ items: twoItems, totalCount: 2 });
    });

    async function selectFirstAndOpenDialog() {
      render(<AuditLogView />);
      await waitFor(() => expect(selectionCheckboxes()).toHaveLength(2));
      fireEvent.click(selectionCheckboxes()[0]);
      fireEvent.click(screen.getByRole('button', { name: /eliminar \(1\)/i }));
      return within(await screen.findByRole('dialog'));
    }

    it('confirmar llama al servicio con los ids, avisa con snackbar y recarga', async () => {
      mockDelete.mockResolvedValue(1);
      const snackbar = vi.fn();
      window.addEventListener('rffm.show_snackbar', snackbar);

      const dialog = await selectFirstAndOpenDialog();
      mockSearchAuditLog.mockClear();
      fireEvent.click(dialog.getByRole('button', { name: 'Eliminar' }));

      await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(['log-1']));
      await waitFor(() => expect(snackbar).toHaveBeenCalled());
      const event = snackbar.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toEqual({ message: '1 evento eliminado', severity: 'success' });
      await waitFor(() => expect(mockSearchAuditLog).toHaveBeenCalled());
      window.removeEventListener('rffm.show_snackbar', snackbar);
    });

    it('cancelar no borra y mantiene la selección', async () => {
      const dialog = await selectFirstAndOpenDialog();
      fireEvent.click(dialog.getByRole('button', { name: 'Cancelar' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(mockDelete).not.toHaveBeenCalled();
      expect(screen.getByText('1 seleccionado')).toBeInTheDocument();
    });

    it('si la petición falla avisa con error y mantiene la selección', async () => {
      mockDelete.mockRejectedValue(new Error('Network error'));
      const snackbar = vi.fn();
      window.addEventListener('rffm.show_snackbar', snackbar);

      const dialog = await selectFirstAndOpenDialog();
      fireEvent.click(dialog.getByRole('button', { name: 'Eliminar' }));

      await waitFor(() => expect(snackbar).toHaveBeenCalled());
      const event = snackbar.mock.calls[0][0] as CustomEvent;
      expect(event.detail.severity).toBe('error');
      expect(screen.getByText('1 seleccionado')).toBeInTheDocument();
      window.removeEventListener('rffm.show_snackbar', snackbar);
    });
  });
});
