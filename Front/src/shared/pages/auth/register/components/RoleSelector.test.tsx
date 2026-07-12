import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import RoleSelector from "./RoleSelector";

describe("RoleSelector", () => {
  it("renders all 6 role options", () => {
    render(<RoleSelector value="" onChange={() => {}} />);
    expect(screen.getByLabelText("Directivo de club")).toBeInTheDocument();
    expect(screen.getByLabelText("Entrenador")).toBeInTheDocument();
    expect(screen.getByLabelText("Jugador")).toBeInTheDocument();
    expect(screen.getByLabelText("Familiar de jugador")).toBeInTheDocument();
    expect(screen.getByLabelText("Seguidor")).toBeInTheDocument();
    expect(screen.getByLabelText("Miembro de club")).toBeInTheDocument();
  });

  it("fires onChange with the correct UserType when an option is selected", () => {
    const onChange = vi.fn();
    render(<RoleSelector value="" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Entrenador"));
    expect(onChange).toHaveBeenCalledWith("Coach");
  });

  it("renders the RadioGroup without the row layout (stacked)", () => {
    render(<RoleSelector value="" onChange={() => {}} />);
    const group = screen.getByRole("radiogroup");
    expect(group.className).not.toMatch(/MuiFormGroup-row/);
  });
});
