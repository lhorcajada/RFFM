import { client } from "../../../../core/api/client";

export type SavedComboRequest = {
  competitionId?: string;
  competitionName?: string;
  groupId?: string;
  groupName?: string;
  teamId?: string;
  teamName?: string;
  isPrimary?: boolean;
};

export type SavedComboResponse = {
  id: string;
  competitionId?: string;
  competitionName?: string;
  groupId?: string;
  groupName?: string;
  teamId?: string;
  teamName?: string;
  createdAt: number;
  isPrimary?: boolean;
};

export class SettingsService {
  async getSettings(): Promise<SavedComboResponse[]> {
    const response = await client.get<SavedComboResponse[]>(
      "federation/settings"
    );
    return response.data;
  }

  async saveSettings(data: SavedComboRequest): Promise<SavedComboResponse> {
    const response = await client.post<SavedComboResponse>(
      "federation/settings",
      data
    );
    return response.data;
  }

  async deleteSettings(id: string): Promise<void> {
    await client.delete(`federation/settings/${id}`);
  }

  async setPrimarySettings(id: string): Promise<void> {
    await client.put(`federation/settings/${id}/primary`);
  }
}

export const settingsService = new SettingsService();
