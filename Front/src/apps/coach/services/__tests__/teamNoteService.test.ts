import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import client from "../../../../core/api/client";
import {
  getTeamNotes,
  createTeamNote,
  updateTeamNote,
  deleteTeamNote,
} from "../teamNoteService";
import type { TeamNote } from "../teamNoteService";

describe("teamNoteService", () => {
  beforeEach(() => vi.resetAllMocks());

  it("getTeamNotes calls GET /api/teams/{teamId}/notes and returns the response", async () => {
    const notes: TeamNote[] = [
      { id: "n1", teamId: "team-1", text: "Traed las dos equipaciones", order: 0 },
      { id: "n2", teamId: "team-1", text: "Espinilleras obligatorias", order: 1 },
    ];
    (client.get as any).mockResolvedValue({ data: notes });

    const res = await getTeamNotes("team-1");

    expect(client.get).toHaveBeenCalledWith("/api/teams/team-1/notes");
    expect(res).toEqual(notes);
  });

  it("getTeamNotes encodes the teamId in the URL", async () => {
    (client.get as any).mockResolvedValue({ data: [] });

    await getTeamNotes("team/with space");

    expect(client.get).toHaveBeenCalledWith(
      `/api/teams/${encodeURIComponent("team/with space")}/notes`,
    );
  });

  it("createTeamNote calls POST /api/teams/{teamId}/notes with the text payload", async () => {
    const created: TeamNote = { id: "n3", teamId: "team-1", text: "Nueva nota", order: 2 };
    (client.post as any).mockResolvedValue({ data: created });

    const res = await createTeamNote("team-1", "Nueva nota");

    expect(client.post).toHaveBeenCalledWith("/api/teams/team-1/notes", { text: "Nueva nota" });
    expect(res).toEqual(created);
  });

  it("updateTeamNote calls PUT /api/teams/{teamId}/notes/{noteId} with the text payload", async () => {
    const updated: TeamNote = { id: "n1", teamId: "team-1", text: "Editada", order: 0 };
    (client.put as any).mockResolvedValue({ data: updated });

    const res = await updateTeamNote("team-1", "n1", "Editada");

    expect(client.put).toHaveBeenCalledWith("/api/teams/team-1/notes/n1", { text: "Editada" });
    expect(res).toEqual(updated);
  });

  it("deleteTeamNote calls DELETE /api/teams/{teamId}/notes/{noteId}", async () => {
    (client.delete as any).mockResolvedValue({ data: undefined });

    await deleteTeamNote("team-1", "n1");

    expect(client.delete).toHaveBeenCalledWith("/api/teams/team-1/notes/n1");
  });
});
