import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import RoleSelector from "./RoleSelector";

describe("RoleSelector", () => {
  it("renders only the enabled role options", () => {
    render(<RoleSelector value="" onChange={() => {}} />);
    expect(screen.getByLabelText("Entrenador")).toBeInTheDocument();
    expect(screen.getByLabelText("Jugador")).toBeInTheDocument();
    expect(screen.getByLabelText("Familiar de jugador")).toBeInTheDocument();
  });

  it("hides roles not yet enabled in this product version", () => {
    render(<RoleSelector value="" onChange={() => {}} />);
    expect(screen.queryByLabelText("Directivo de club")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Seguidor")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Miembro de club")).not.toBeInTheDocument();
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
