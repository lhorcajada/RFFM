import { useState } from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import InvitationCodeField from "./InvitationCodeField";
import { invitationsApi } from "../../../../services/invitations/invitationsApi";

vi.mock("../../../../services/invitations/invitationsApi", () => ({
  invitationsApi: {
    previewClubCode: vi.fn(),
    previewTeamCode: vi.fn(),
  },
}));

// Test harness mirroring how Register.tsx wires the controlled value/onChange
// props into InvitationCodeField (parent owns the typed code).
function ControlledInvitationCodeField(
  props: Omit<Parameters<typeof InvitationCodeField>[0], "value" | "onChange"> & {
    onCodeChange?: (value: string) => void;
  }
) {
  const { onCodeChange, ...rest } = props;
  const [value, setValue] = useState("");
  return (
    <InvitationCodeField
      {...(rest as any)}
      value={value}
      onChange={(next) => {
        setValue(next);
        onCodeChange?.(next);
      }}
    />
  );
}

describe("InvitationCodeField", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("club code", () => {
    it("shows spinner while checking code", async () => {
      vi.mocked(invitationsApi.previewClubCode).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const onValid = vi.fn();
      const onInvalid = vi.fn();

      render(
        <ControlledInvitationCodeField
          kind="club"
          membershipKind="Coach"
          onValid={onValid}
          onInvalid={onInvalid}
        />
      );

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: "ABC123" } });

      // Wait for the debounce (500ms) + render
      await waitFor(
        () => {
          expect(screen.queryByRole("progressbar")).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it("shows success affordance and calls onValid when code is valid", async () => {
      vi.mocked(invitationsApi.previewClubCode).mockResolvedValue({
        clubId: "c1",
        clubName: "Test Club",
        membershipKind: "Coach",
      });

      const onValid = vi.fn();
      const onInvalid = vi.fn();

      render(
        <ControlledInvitationCodeField
          kind="club"
          membershipKind="Coach"
          onValid={onValid}
          onInvalid={onInvalid}
        />
      );

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: "ABC123" } });

      await waitFor(
        () => {
          expect(vi.mocked(invitationsApi.previewClubCode)).toHaveBeenCalledWith(
            expect.objectContaining({ code: "ABC123" })
          );
          expect(onValid).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );
    });

    it("shows error message and calls onInvalid when code is invalid", async () => {
      vi.mocked(invitationsApi.previewClubCode).mockRejectedValue({
        response: {
          data: {
            code: "ClubInvitationCodeInvalid",
            detail: "Code not found",
          },
        },
      });

      const onValid = vi.fn();
      const onInvalid = vi.fn();

      render(
        <ControlledInvitationCodeField
          kind="club"
          membershipKind="Coach"
          onValid={onValid}
          onInvalid={onInvalid}
        />
      );

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: "INVALID" } });

      await waitFor(
        () => {
          expect(onInvalid).toHaveBeenCalled();
          // Check that error state is shown by looking for helper text
          const fieldElement = input.closest(".MuiOutlinedInput-root");
          expect(fieldElement).toHaveClass("Mui-error");
        },
        { timeout: 2000 }
      );
    });

  });

  describe("team code", () => {
    it("shows success with roster when team code is valid", async () => {
      vi.mocked(invitationsApi.previewTeamCode).mockResolvedValue({
        teamId: "t1",
        teamName: "Test Team",
        clubId: "c1",
        membershipKind: "Player",
        players: [
          {
            teamPlayerId: "tp1",
            playerId: "p1",
            name: "John",
            lastName: "Doe",
            urlPhoto: null,
            dorsal: 10,
            alreadyLinked: false,
          },
        ],
      });

      const onValid = vi.fn();

      render(
        <ControlledInvitationCodeField
          kind="team"
          membershipKind="Player"
          onValid={onValid}
          onInvalid={() => {}}
        />
      );

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: "TEAM123" } });

      await waitFor(
        () => {
          expect(onValid).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );
    });

    it("propagates the typed code to the parent via onChange (regression: payload must not stay empty)", async () => {
      vi.mocked(invitationsApi.previewTeamCode).mockResolvedValue({
        teamId: "t1",
        teamName: "Test Team",
        clubId: "c1",
        membershipKind: "Player",
        players: [],
      });

      const onCodeChange = vi.fn();

      render(
        <ControlledInvitationCodeField
          kind="team"
          membershipKind="Player"
          onValid={() => {}}
          onInvalid={() => {}}
          onCodeChange={onCodeChange}
        />
      );

      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: "TEAM123" } });

      expect(onCodeChange).toHaveBeenCalledWith("TEAM123");
      expect(screen.getByDisplayValue("TEAM123")).toBeInTheDocument();
    });
  });
});
