import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { UserProvider } from "../../../../../../shared/context/UserContext";

const mockUseMediaQuery = vi.fn();
vi.mock("@mui/material/useMediaQuery", () => ({
  default: (...args: unknown[]) => mockUseMediaQuery(...args),
}));

vi.mock("../../../../services/trainingService", () => ({
  default: {
    getExerciseById: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("../../../../services/teamplayerService", () => ({
  default: { getPlayersByTeam: vi.fn().mockResolvedValue([]) },
}));

import NewExercisePage from "../NewExercisePage";

function renderPage() {
  return render(
    <UserProvider>
      <MemoryRouter initialEntries={["/coach/trainings/new-exercise?clubId=club-1"]}>
        <NewExercisePage />
      </MemoryRouter>
    </UserProvider>,
  );
}

describe("NewExercisePage - mobile blocking", () => {
  beforeEach(() => {
    mockUseMediaQuery.mockReset();
  });

  it("shows the mobile-blocked message instead of the tactical board on a mobile viewport", () => {
    mockUseMediaQuery.mockReturnValue(true);

    renderPage();

    expect(
      screen.getByText(/no está disponible desde dispositivos móviles/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Chapas")).not.toBeInTheDocument();
  });

  it("shows the normal editor workspace on desktop/tablet viewports", () => {
    mockUseMediaQuery.mockReturnValue(false);

    renderPage();

    expect(
      screen.queryByText(/no está disponible desde dispositivos móviles/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Chapas")).toBeInTheDocument();
  });
});

describe("NewExercisePage - full pitch", () => {
  beforeEach(() => {
    mockUseMediaQuery.mockReset();
    mockUseMediaQuery.mockReturnValue(false);
  });

  it("renders both the interactive half and its mirrored (decorative) twin, forming a full pitch", () => {
    const { container } = renderPage();

    expect(container.querySelector('[class*="fullPitch"]')).not.toBeNull();

    const mirrorHalf = container.querySelector('[class*="mirrorHalf"]');
    expect(mirrorHalf).not.toBeNull();
    expect(mirrorHalf).toHaveAttribute("aria-hidden", "true");

    // Both the mirrored half and the interactive half render their own
    // Fútbol 7 overlay ("en cada campo").
    expect(container.querySelectorAll('[class*="f7Pitch"]')).toHaveLength(2);
  });
});

describe("NewExercisePage - cabecera y herramientas", () => {
  beforeEach(() => {
    mockUseMediaQuery.mockReset();
    mockUseMediaQuery.mockReturnValue(false);
  });

  it("permite editar el título del ejercicio desde la cabecera", async () => {
    renderPage();

    const title = screen.getByLabelText("Título");
    await userEvent.type(title, "Rondo 4x2");

    expect(title).toHaveValue("Rondo 4x2");
  });

  it("alterna la herramienta Chapas con aria-pressed", async () => {
    renderPage();

    const chapas = screen.getByRole("button", { name: "Chapas" });
    expect(chapas).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(chapas);

    expect(screen.getByRole("button", { name: "Chapas" })).toHaveAttribute("aria-pressed", "true");
  });
});
