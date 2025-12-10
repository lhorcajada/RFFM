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

  async getSettingsForUser(userId?: string): Promise<SavedComboResponse[]> {
    const url = userId
      ? `federation/settings?userId=${encodeURIComponent(userId)}`
      : `federation/settings`;
    const response = await client.get<SavedComboResponse[]>(url);
    return response.data;
  }

  async saveSettings(
    data: SavedComboRequest & { userId?: string }
  ): Promise<SavedComboResponse> {
    const body = { ...data };
    const response = await client.post<SavedComboResponse>(
      "federation/settings",
      body
    );
    return response.data;
  }

  async deleteSettings(id: string, userId?: string): Promise<void> {
    const url = userId
      ? `federation/settings/${id}?userId=${encodeURIComponent(userId)}`
      : `federation/settings/${id}`;
    await client.delete(url);
  }

  async setPrimarySettings(id: string, userId?: string): Promise<void> {
    const url = userId
      ? `federation/settings/${id}/primary?userId=${encodeURIComponent(userId)}`
      : `federation/settings/${id}/primary`;
    await client.put(url);
  }
}

export const settingsService = new SettingsService();
