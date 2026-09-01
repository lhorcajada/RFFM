import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import MobileEditorBlocked from "../MobileEditorBlocked";

describe("MobileEditorBlocked", () => {
  it("informs the user that editing exercises is not available on mobile devices", () => {
    render(<MobileEditorBlocked onBack={vi.fn()} />);

    expect(
      screen.getByText(/no está disponible desde dispositivos móviles/i),
    ).toBeInTheDocument();
  });

  it("calls onBack when the user clicks the back button", async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<MobileEditorBlocked onBack={onBack} />);

    await user.click(screen.getByRole("button", { name: /volver/i }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
