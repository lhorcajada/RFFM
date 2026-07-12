import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import TeamPlayerPicker from "./TeamPlayerPicker";
import type { TeamRosterPlayer } from "../../../../types/scope";

describe("TeamPlayerPicker", () => {
  const mockPlayers: TeamRosterPlayer[] = [
    {
      teamPlayerId: "tp1",
      playerId: "p1",
      name: "John",
      lastName: "Doe",
      urlPhoto: "https://example.com/photo.jpg",
      dorsal: 10,
      alreadyLinked: false,
    },
    {
      teamPlayerId: "tp2",
      playerId: "p2",
      name: "Jane",
      lastName: "Smith",
      urlPhoto: null,
      dorsal: 7,
      alreadyLinked: true,
    },
    {
      teamPlayerId: "tp3",
      playerId: "p3",
      name: "Bob",
      lastName: null,
      urlPhoto: null,
      dorsal: null,
      alreadyLinked: false,
    },
  ];

  it("renders a row for each player", () => {
    const onSelect = vi.fn();
    render(
      <TeamPlayerPicker
        players={mockPlayers}
        role="FamilyMember"
        selectedId={null}
        onSelect={onSelect}
      />
    );

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  describe("Player role", () => {
    it("disables rows with alreadyLinked=true", () => {
      const onSelect = vi.fn();
      render(
        <TeamPlayerPicker
          players={mockPlayers}
          role="Player"
          selectedId={null}
          onSelect={onSelect}
        />
      );

      const linkedRow = screen.getByLabelText("Jane Smith");
      expect(linkedRow).toHaveAttribute("aria-disabled", "true");
      expect(linkedRow.classList.contains("Mui-disabled")).toBe(true);
    });

    it("shows 'Ya vinculado' caption for already linked players", () => {
      const onSelect = vi.fn();
      render(
        <TeamPlayerPicker
          players={mockPlayers}
          role="Player"
          selectedId={null}
          onSelect={onSelect}
        />
      );

      expect(screen.getByText(/Ya vinculado/)).toBeInTheDocument();
    });

    it("allows selecting non-linked players", () => {
      const onSelect = vi.fn();
      render(
        <TeamPlayerPicker
          players={mockPlayers}
          role="Player"
          selectedId={null}
          onSelect={onSelect}
        />
      );

      const johnRow = screen.getByLabelText("John Doe");
      fireEvent.click(johnRow);

      expect(onSelect).toHaveBeenCalledWith("tp1");
    });
  });

  describe("FamilyMember role", () => {
    it("enables all rows regardless of alreadyLinked", () => {
      const onSelect = vi.fn();
      render(
        <TeamPlayerPicker
          players={mockPlayers}
          role="FamilyMember"
          selectedId={null}
          onSelect={onSelect}
        />
      );

      const linkedRow = screen.getByLabelText("Jane Smith");
      expect(linkedRow).not.toHaveAttribute("aria-disabled", "true");
      expect(linkedRow).not.toBeDisabled();
    });

    it("allows selecting any player", () => {
      const onSelect = vi.fn();
      render(
        <TeamPlayerPicker
          players={mockPlayers}
          role="FamilyMember"
          selectedId={null}
          onSelect={onSelect}
        />
      );

      const linkedRow = screen.getByLabelText("Jane Smith");
      fireEvent.click(linkedRow);

      expect(onSelect).toHaveBeenCalledWith("tp2");
    });
  });

  it("shows selected state when selectedId matches", () => {
    const onSelect = vi.fn();
    render(
      <TeamPlayerPicker
        players={mockPlayers}
        role="Player"
        selectedId="tp1"
        onSelect={onSelect}
      />
    );

    const johnRow = screen.getByLabelText("John Doe");
    expect(johnRow).toHaveClass("Mui-selected");
  });

  it("displays dorsal number when available", () => {
    const onSelect = vi.fn();
    render(
      <TeamPlayerPicker
        players={mockPlayers}
        role="FamilyMember"
        selectedId={null}
        onSelect={onSelect}
      />
    );

    expect(screen.getByText("Dorsal 10")).toBeInTheDocument();
    expect(screen.getByText("Dorsal 7")).toBeInTheDocument();
  });

  it("renders alert when players array is empty", () => {
    const onSelect = vi.fn();
    render(
      <TeamPlayerPicker
        players={[]}
        role="Player"
        selectedId={null}
        onSelect={onSelect}
      />
    );

    expect(
      screen.getByText("Este equipo todavía no tiene jugadores en su plantilla.")
    ).toBeInTheDocument();
  });

  it("creates avatar with initials when no photo", () => {
    const onSelect = vi.fn();
    render(
      <TeamPlayerPicker
        players={mockPlayers}
        role="FamilyMember"
        selectedId={null}
        onSelect={onSelect}
      />
    );

    // Bob has no lastName, so initials should be "B"
    const bobAvatar = screen.getByText("B");
    expect(bobAvatar).toBeInTheDocument();

    // Jane has lastName, so initials should be "JS"
    const janeAvatar = screen.getByText("JS");
    expect(janeAvatar).toBeInTheDocument();
  });
});
