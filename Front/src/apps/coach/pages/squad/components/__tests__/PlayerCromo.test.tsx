import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import PlayerCromo from "../PlayerCromo";

describe("PlayerCromo", () => {
  it("muestra el alias del jugador cuando existe, en lugar del nombre completo", () => {
    render(
      <MemoryRouter>
        <PlayerCromo displayName="Juan Pérez García" alias="Juanito" />
      </MemoryRouter>
    );

    expect(screen.getByText("Juanito")).toBeInTheDocument();
    expect(screen.queryByText("Juan Pérez García")).not.toBeInTheDocument();
  });

  it("muestra el nombre completo cuando el jugador no tiene alias", () => {
    render(
      <MemoryRouter>
        <PlayerCromo displayName="Juan Pérez García" alias={null} />
      </MemoryRouter>
    );

    expect(screen.getByText("Juan Pérez García")).toBeInTheDocument();
  });

  it("muestra el nombre completo cuando el alias es una cadena vacía", () => {
    render(
      <MemoryRouter>
        <PlayerCromo displayName="Juan Pérez García" alias="   " />
      </MemoryRouter>
    );

    expect(screen.getByText("Juan Pérez García")).toBeInTheDocument();
  });

  it("muestra el avatar por defecto cuando el jugador no tiene foto", () => {
    render(
      <MemoryRouter>
        <PlayerCromo displayName="Juan Pérez García" photoSrc={null} />
      </MemoryRouter>
    );

    const avatar = screen.getByAltText("Juan Pérez García");
    expect(avatar).toBeInTheDocument();
    expect(avatar.className).toContain("photoAvatar");
  });

  it("muestra la foto del jugador cuando existe", () => {
    render(
      <MemoryRouter>
        <PlayerCromo
          displayName="Juan Pérez García"
          photoSrc="blob:http://localhost/photo123"
        />
      </MemoryRouter>
    );

    const photo = screen.getByAltText("Juan Pérez García");
    expect(photo.getAttribute("src")).toBe("blob:http://localhost/photo123");
  });
});
