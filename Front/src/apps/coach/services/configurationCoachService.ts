import client from "../../../core/api/client";

export type ConfigurationCoachDto = {
  id: number;
  coachId: string;
  preferredClubId?: string | null;
  preferredTeamId?: string | null;
};

export type ConfigurationCoachRequest = {
  coachId: string;
  preferredClubId?: string | null;
  preferredTeamId?: string | null;
};

const baseUrl = "/api/coaches/configuration";

const getAll = async (): Promise<ConfigurationCoachDto[]> => {
  const { data } = await client.get<ConfigurationCoachDto[]>(baseUrl);
  return data;
};

const getById = async (id: number): Promise<ConfigurationCoachDto> => {
  const { data } = await client.get<ConfigurationCoachDto>(`${baseUrl}/${id}`);
  return data;
};

const create = async (
  req: ConfigurationCoachRequest
): Promise<ConfigurationCoachDto> => {
  const { data } = await client.post<ConfigurationCoachDto>(baseUrl, req);
  return data;
};

const update = async (
  id: number,
  req: ConfigurationCoachRequest
): Promise<ConfigurationCoachDto> => {
  const { data } = await client.put<ConfigurationCoachDto>(
    `${baseUrl}/${id}`,
    req
  );
  return data;
};

const remove = async (id: number): Promise<ConfigurationCoachDto> => {
  const { data } = await client.delete<ConfigurationCoachDto>(
    `${baseUrl}/${id}`
  );
  return data;
};

export default {
  getAll,
  getById,
  create,
  update,
  remove,
};
