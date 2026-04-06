import { client } from "../../../core/api/client";
import type {
  Exercise,
  CreateExerciseRequest,
  UpdateExerciseRequest,
  TrainingSession,
  TrainingSessionDetail,
  CreateSessionRequest,
  UpdateSessionRequest,
} from "../types/training";

const trainingService = {
  // ── Exercises ─────────────────────────────────────────────────────────

  async getExercises(clubId: string, subSubPrincipleId?: string | null): Promise<Exercise[]> {
    const params: Record<string, string> = { clubId };
    if (subSubPrincipleId) params.subSubPrincipleId = subSubPrincipleId;
    const res = await client.get<Exercise[]>("/api/trainings/exercises", { params });
    return res.data;
  },

  async createExercise(data: CreateExerciseRequest): Promise<{ id: string }> {
    const res = await client.post<{ id: string }>("/api/trainings/exercises", data);
    return res.data;
  },

  async updateExercise(id: string, data: UpdateExerciseRequest): Promise<void> {
    await client.put(`/api/trainings/exercises/${id}`, data);
  },

  async deleteExercise(id: string): Promise<void> {
    await client.delete(`/api/trainings/exercises/${id}`);
  },

  async uploadExerciseMedia(id: string, file: File): Promise<{ url: string }> {
    const form = new FormData();
    form.append("file", file, file.name);
    const res = await client.post<{ url: string }>(
      `/api/trainings/exercises/${id}/media`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return res.data;
  },

  async createCondition(exerciseId: string, text: string): Promise<{ id: string; text: string; order: number }> {
    const res = await client.post(`/api/trainings/exercises/${exerciseId}/conditions`, { text });
    return res.data;
  },

  async updateCondition(conditionId: string, text: string): Promise<{ id: string; text: string; order: number }> {
    const res = await client.put(`/api/trainings/exercises/conditions/${conditionId}`, { text });
    return res.data;
  },

  async deleteCondition(conditionId: string): Promise<void> {
    await client.delete(`/api/trainings/exercises/conditions/${conditionId}`);
  },

  // ── Sessions ──────────────────────────────────────────────────────────

  async getSessions(teamId: string, subPrincipleId?: string | null): Promise<TrainingSession[]> {
    const params: Record<string, string> = { teamId };
    if (subPrincipleId) params.subPrincipleId = subPrincipleId;
    const res = await client.get<TrainingSession[]>("/api/trainings/sessions", { params });
    return res.data;
  },

  async getSessionById(id: string): Promise<TrainingSessionDetail> {
    const res = await client.get<TrainingSessionDetail>(`/api/trainings/sessions/${id}`);
    return res.data;
  },

  async createSession(data: CreateSessionRequest): Promise<{ id: string }> {
    const res = await client.post<{ id: string }>("/api/trainings/sessions", data);
    return res.data;
  },

  async updateSession(id: string, data: UpdateSessionRequest): Promise<void> {
    await client.put(`/api/trainings/sessions/${id}`, data);
  },

  async deleteSession(id: string): Promise<void> {
    await client.delete(`/api/trainings/sessions/${id}`);
  },
};

export default trainingService;
