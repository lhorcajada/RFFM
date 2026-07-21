import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CollapsibleGroup from "./CollapsibleGroup";

describe("CollapsibleGroup", () => {
  it("shows the counter even when collapsed", () => {
    render(
      <CollapsibleGroup
        title="Lista de espera"
        count={7}
        colorClassName="dummy"
        expanded={false}
        onToggle={() => {}}
      >
        <div>Contenido oculto</div>
      </CollapsibleGroup>
    );

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.queryByText("Contenido oculto")).not.toBeInTheDocument();
  });

  it("shows the counter and the content when expanded", () => {
    render(
      <CollapsibleGroup
        title="Lista de espera"
        count={3}
        colorClassName="dummy"
        expanded={true}
        onToggle={() => {}}
      >
        <div>Contenido visible</div>
      </CollapsibleGroup>
    );

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Contenido visible")).toBeInTheDocument();
  });

  it("calls onToggle when the header is clicked", async () => {
    const onToggle = vi.fn();
    render(
      <CollapsibleGroup
        title="Aceptados"
        count={2}
        colorClassName="dummy"
        expanded={false}
        onToggle={onToggle}
      >
        <div>Detalle</div>
      </CollapsibleGroup>
    );

    await userEvent.click(screen.getByRole("button", { name: /aceptados/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("reflects expanded state via aria-expanded", () => {
    const { rerender } = render(
      <CollapsibleGroup
        title="Pendientes de aceptar"
        count={1}
        colorClassName="dummy"
        expanded={false}
        onToggle={() => {}}
      >
        <div>Detalle</div>
      </CollapsibleGroup>
    );
    expect(screen.getByRole("button", { name: /pendientes de aceptar/i })).toHaveAttribute(
      "aria-expanded",
      "false"
    );

    rerender(
      <CollapsibleGroup
        title="Pendientes de aceptar"
        count={1}
        colorClassName="dummy"
        expanded={true}
        onToggle={() => {}}
      >
        <div>Detalle</div>
      </CollapsibleGroup>
    );
    expect(screen.getByRole("button", { name: /pendientes de aceptar/i })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });
});
