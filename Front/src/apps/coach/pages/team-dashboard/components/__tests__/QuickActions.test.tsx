import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COACH_FEATURE_ROUTES } from "../../../../constants/featureRoutes";

const mockPermissions = vi.fn();
vi.mock("../../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => mockPermissions(),
}));

import QuickActions from "../QuickActions";

function renderActions() {
  return render(
    <MemoryRouter>
      <QuickActions teamId="team-1" />
    </MemoryRouter>,
  );
}

describe("QuickActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra solo las acciones con permiso, con el equipo en la ruta", () => {
    const allowed = new Set<string>([COACH_FEATURE_ROUTES.Squad, COACH_FEATURE_ROUTES.Injured]);
    mockPermissions.mockReturnValue({ loading: false, hasFeatureAccess: (route: string) => allowed.has(route) });

    renderActions();

    expect(screen.getByRole("link", { name: "Plantilla" })).toHaveAttribute("href", "/coach/squad?teamId=team-1");
    expect(screen.getByRole("link", { name: "Lesionados" })).toHaveAttribute("href", "/coach/injured?teamId=team-1");
    expect(screen.queryByRole("link", { name: "Resumen de asistencias" })).not.toBeInTheDocument();
  });

  it("no se muestra sin ninguna acción permitida", () => {
    mockPermissions.mockReturnValue({ loading: false, hasFeatureAccess: () => false });
    renderActions();
    expect(screen.queryByRole("heading", { name: "Acciones rápidas" })).not.toBeInTheDocument();
  });

  it("no se muestra mientras cargan los permisos", () => {
    mockPermissions.mockReturnValue({ loading: true, hasFeatureAccess: () => true });
    renderActions();
    expect(screen.queryByRole("heading", { name: "Acciones rápidas" })).not.toBeInTheDocument();
  });
});
