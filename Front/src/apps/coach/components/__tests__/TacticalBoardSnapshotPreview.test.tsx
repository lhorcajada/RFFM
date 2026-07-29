import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TacticalBoardSnapshotPreview, {
  hasBoardObjects,
  tryParseBoardSnapshot,
} from "../TacticalBoardSnapshotPreview";
import styles from "../TacticalBoardSnapshotPreview.module.css";
import { __resetTeamRosterCacheForTests } from "../../hooks/useTeamRoster";
import teamplayerService from "../../services/teamplayerService";
import type { TacticalBoardSnapshot } from "../../pages/trainings/new/types";

vi.mock("../../services/teamplayerService", () => ({
  default: { getPlayersByTeam: vi.fn() },
  getPlayersByTeam: vi.fn(),
}));

function emptySnapshot(): TacticalBoardSnapshot {
  return {
    placedChapas: {},
    chapaPetoById: {},
    placedSpaces: [],
    placedMaterials: [],
    placedLines: [],
  };
}

describe("TacticalBoardSnapshotPreview", () => {
  beforeEach(() => {
    __resetTeamRosterCacheForTests();
    vi.mocked(teamplayerService.getPlayersByTeam).mockReset();
  });

  it("parses valid JSON and rejects invalid JSON", () => {
    const snapshot = emptySnapshot();
    expect(tryParseBoardSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(tryParseBoardSnapshot("not json")).toBeNull();
    expect(tryParseBoardSnapshot(null)).toBeNull();
  });

  it("hasBoardObjects reports false for an empty snapshot and true when any layer has content", () => {
    expect(hasBoardObjects(emptySnapshot())).toBe(false);
    expect(hasBoardObjects({ ...emptySnapshot(), placedLines: [{ id: "l1", kind: "straight", color: "#fff", x1: 0, y1: 0, x2: 1, y2: 1 }] })).toBe(true);
  });

  it("renders the real field silhouette (half pitch with goal), not a generic full-field box", () => {
    const { container } = render(<TacticalBoardSnapshotPreview snapshot={emptySnapshot()} />);
    expect(container.querySelector(`.${styles.terrainBandTop}`)).toBeInTheDocument();
    expect(container.querySelector(`.${styles.terrainGoalBack}`)).toBeInTheDocument();
    expect(container.querySelector(`.${styles.goalMouth}`)).toBeInTheDocument();
    expect(container.querySelector(`.${styles.goalFrame}`)).toBeInTheDocument();
    expect(container.querySelector(`.${styles.penaltyArc}`)).toBeInTheDocument();
    expect(container.querySelector(`.${styles.penaltySpot}`)).toBeInTheDocument();
  });

  it("renders a placed line as a real SVG path built via buildLinePath, including arrow markers", () => {
    const snapshot: TacticalBoardSnapshot = {
      ...emptySnapshot(),
      placedLines: [
        { id: "l1", kind: "arrow", color: "#ff4444", x1: 10, y1: 10, x2: 60, y2: 40 },
      ],
    };
    const { container } = render(<TacticalBoardSnapshotPreview snapshot={snapshot} />);
    const path = container.querySelector("path[marker-end]");
    expect(path).toBeInTheDocument();
    expect(path).toHaveAttribute("d", "M 10 10 L 60 40");
    expect(path?.getAttribute("marker-end")).toContain("url(#preview-line-arrow-red)");
  });

  it("renders a curved line using the quadratic path built by buildLinePath", () => {
    const snapshot: TacticalBoardSnapshot = {
      ...emptySnapshot(),
      placedLines: [
        { id: "l1", kind: "curved", color: "#ffffff", x1: 0, y1: 0, x2: 100, y2: 0, cx: 50, cy: -20 },
      ],
    };
    const { container } = render(<TacticalBoardSnapshotPreview snapshot={snapshot} />);
    const path = container.querySelector("svg > path");
    expect(path).toHaveAttribute("d", "M 0 0 Q 50 -20 100 0");
  });

  it("renders material-specific glyphs (setas vs vallas) instead of a generic dot", () => {
    const snapshot: TacticalBoardSnapshot = {
      ...emptySnapshot(),
      placedMaterials: [
        { id: "m1", kind: "setas", x: 20, y: 20, rotation: 0 },
        { id: "m2", kind: "vallas", x: 40, y: 40, rotation: 0 },
      ],
    };
    const { container } = render(<TacticalBoardSnapshotPreview snapshot={snapshot} />);
    expect(container.querySelector(`.${styles.materialGlyph_setas}`)).toBeInTheDocument();
    expect(container.querySelector(`.${styles.materialSetaHole}`)).toBeInTheDocument();
    expect(container.querySelector(`.${styles.materialGlyph_vallas}`)).toBeInTheDocument();
    expect(container.querySelector(`.${styles.materialVallaBar}`)).toBeInTheDocument();
  });

  it("shows dorsal and alias for a named chapa once the team roster resolves", async () => {
    vi.mocked(teamplayerService.getPlayersByTeam).mockResolvedValue([
      { id: "player-1", name: "Ana", alias: "Ani", dorsal: 9 } as any,
    ]);

    const snapshot: TacticalBoardSnapshot = {
      ...emptySnapshot(),
      placedChapas: { "player-1": { x: 30, y: 30 } },
    };

    render(<TacticalBoardSnapshotPreview snapshot={snapshot} teamId="team-1" />);

    await waitFor(() => {
      expect(screen.getByText("9")).toBeInTheDocument();
      expect(screen.getByText("Ani")).toBeInTheDocument();
    });
  });

  it("does not render dorsal/alias for an anonymous chapa", () => {
    const snapshot: TacticalBoardSnapshot = {
      ...emptySnapshot(),
      placedChapas: { "anon-1": { x: 30, y: 30, anonymous: true } },
    };
    render(<TacticalBoardSnapshotPreview snapshot={snapshot} />);
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });
});
