import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useTeamRoster, __resetTeamRosterCacheForTests } from "../useTeamRoster";
import teamplayerService from "../../services/teamplayerService";

vi.mock("../../services/teamplayerService", () => ({
  default: { getPlayersByTeam: vi.fn() },
  getPlayersByTeam: vi.fn(),
}));

function RosterProbe({ teamId, label }: { teamId: string; label: string }) {
  const { players, playersById, loading } = useTeamRoster(teamId);
  return (
    <div data-testid={label}>
      {loading ? "loading" : `${players.length}:${playersById.size}`}
    </div>
  );
}

describe("useTeamRoster", () => {
  beforeEach(() => {
    __resetTeamRosterCacheForTests();
    vi.mocked(teamplayerService.getPlayersByTeam).mockReset();
  });

  it("resolves players and exposes them indexed by id", async () => {
    vi.mocked(teamplayerService.getPlayersByTeam).mockResolvedValue([
      { id: "p1", name: "Ana", alias: "Ani", dorsal: 7 } as any,
    ]);

    render(<RosterProbe teamId="team-1" label="probe" />);

    await waitFor(() => {
      expect(screen.getByTestId("probe")).toHaveTextContent("1:1");
    });
  });

  it("shares a single network call across multiple consumers of the same team", async () => {
    vi.mocked(teamplayerService.getPlayersByTeam).mockResolvedValue([
      { id: "p1", name: "Ana", alias: "Ani", dorsal: 7 } as any,
    ]);

    render(
      <>
        <RosterProbe teamId="team-shared" label="probe-a" />
        <RosterProbe teamId="team-shared" label="probe-b" />
      </>
    );

    await waitFor(() => {
      expect(screen.getByTestId("probe-a")).toHaveTextContent("1:1");
      expect(screen.getByTestId("probe-b")).toHaveTextContent("1:1");
    });

    expect(teamplayerService.getPlayersByTeam).toHaveBeenCalledTimes(1);
  });

  it("returns an empty roster without fetching when teamId is missing", () => {
    render(<RosterProbe teamId="" label="probe-empty" />);
    expect(screen.getByTestId("probe-empty")).toHaveTextContent("0:0");
    expect(teamplayerService.getPlayersByTeam).not.toHaveBeenCalled();
  });
});
