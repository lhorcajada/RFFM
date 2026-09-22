import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import RequireAuth from "./RequireAuth";

const hasRoleMock = vi.fn();
const isAuthenticatedMock = vi.fn();

vi.mock("../../apps/coach/services/authService", () => ({
  coachAuthService: {
    isAuthenticated: () => isAuthenticatedMock(),
    hasRole: (role: string) => hasRoleMock(role),
    logout: vi.fn(),
  },
}));

function renderWithGuard(requiredRoles?: string[]) {
  return render(
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <RequireAuth requiredRoles={requiredRoles}>
              <div>contenido protegido</div>
            </RequireAuth>
          }
        />
        <Route path="/appSelector" element={<div>appSelector</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RequireAuth", () => {
  beforeEach(() => {
    hasRoleMock.mockReset();
    isAuthenticatedMock.mockReset();
    isAuthenticatedMock.mockReturnValue(true);
  });

  it("permite el acceso cuando el usuario tiene al menos uno de los roles requeridos", async () => {
    hasRoleMock.mockImplementation((role: string) => role === "FamilyMember");

    renderWithGuard(["Federation", "Player", "FamilyMember"]);

    await waitFor(() =>
      expect(screen.getByText("contenido protegido")).toBeInTheDocument()
    );
  });

  it("redirige a appSelector cuando el usuario no tiene ninguno de los roles requeridos", async () => {
    hasRoleMock.mockReturnValue(false);

    renderWithGuard(["Federation", "Player", "FamilyMember"]);

    await waitFor(() => expect(screen.getByText("appSelector")).toBeInTheDocument());
  });
});
