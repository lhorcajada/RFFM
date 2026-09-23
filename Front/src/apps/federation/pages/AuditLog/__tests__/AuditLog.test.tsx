import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuditLog } from '../AuditLog';

// Mock the shared AuditLogView component
vi.mock('../../../../../shared/components/ui/AuditLogView/AuditLogView', () => ({
  AuditLogView: () => <div>AuditLogView Mocked</div>,
}));

describe('Federation AuditLog', () => {
  it('renders the AuditLogView component', () => {
    render(
      <MemoryRouter>
        <AuditLog />
      </MemoryRouter>
    );

    expect(screen.getByText('AuditLogView Mocked')).toBeInTheDocument();
  });
});
