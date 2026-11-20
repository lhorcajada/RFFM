import { client } from "../../../core/api/client";

export type AiProviderTemplateId = "claude" | "openai" | "gemini" | "custom";

export type AiProvider = {
  id: string;
  template: AiProviderTemplateId;
  baseUrl: string;
  model: string;
  maskedApiKey: string;
  isActive: boolean;
};

/** `apiKey` is null (or blank) when editing without replacing the stored key. */
export type AiProviderRequest = {
  template: AiProviderTemplateId;
  baseUrl: string;
  apiKey: string | null;
  model: string;
};

/** `id` points at a saved provider whose stored key is used when `apiKey` is blank. */
export type AiConnectionTestRequest = AiProviderRequest & { id: string | null };

export type AiConnectionTestResult = {
  success: boolean;
  failure: string | null;
  message: string;
};

/** `id` points at a saved provider whose stored key is used when `apiKey` is blank. */
export type AiModelsRequest = Omit<AiProviderRequest, "model"> & { id: string | null };

export type AiModelsResult = {
  success: boolean;
  failure: string | null;
  message: string;
  models: string[];
};

export async function getAiProviders(): Promise<AiProvider[]> {
  const res = await client.get<AiProvider[]>("/api/ai-providers");
  return res.data;
}

export async function createAiProvider(request: AiProviderRequest): Promise<AiProvider> {
  const res = await client.post<AiProvider>("/api/ai-providers", request);
  return res.data;
}

export async function updateAiProvider(id: string, request: AiProviderRequest): Promise<AiProvider> {
  const res = await client.put<AiProvider>(`/api/ai-providers/${id}`, request);
  return res.data;
}

export async function deleteAiProvider(id: string): Promise<void> {
  await client.delete(`/api/ai-providers/${id}`);
}

export async function activateAiProvider(id: string): Promise<void> {
  await client.post(`/api/ai-providers/${id}/activate`);
}

export async function listAiProviderModels(request: AiModelsRequest): Promise<AiModelsResult> {
  const res = await client.post<AiModelsResult>("/api/ai-providers/models", request);
  return res.data;
}

export async function testAiProviderConnection(request: AiConnectionTestRequest): Promise<AiConnectionTestResult> {
  const res = await client.post<AiConnectionTestResult>("/api/ai-providers/test", request);
  return res.data;
}
