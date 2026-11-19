import type { AiProviderTemplateId } from "../../services/aiProviderService";

export type AiProviderTemplate = {
  id: AiProviderTemplateId;
  label: string;
  baseUrl: string;
  model: string;
  hint: string | null;
};

export const AI_PROVIDER_TEMPLATES: AiProviderTemplate[] = [
  {
    id: "claude",
    label: "Claude (Anthropic)",
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-5",
    hint: null,
  },
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    hint: null,
  },
  {
    id: "gemini",
    label: "Gemini (gratuito)",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.0-flash",
    hint: "El plan gratuito tiene cuota limitada y sus condiciones pueden cambiar sin aviso.",
  },
  {
    id: "custom",
    label: "Otro (compatible con OpenAI)",
    baseUrl: "",
    model: "",
    hint: "Cualquier proveedor con API compatible con OpenAI, como Groq u OpenRouter.",
  },
];

export function findAiProviderTemplate(id: AiProviderTemplateId): AiProviderTemplate {
  return AI_PROVIDER_TEMPLATES.find((template) => template.id === id) ?? AI_PROVIDER_TEMPLATES[AI_PROVIDER_TEMPLATES.length - 1];
}
