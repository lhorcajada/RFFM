import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TeamCrest from "../TeamCrest";

describe("TeamCrest", () => {
  it("expone el escudo genérico como imagen accesible", () => {
    render(<TeamCrest />);
    expect(screen.getByRole("img", { name: "Escudo genérico de equipo" })).toBeInTheDocument();
  });
});
