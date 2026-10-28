import { client } from "../../core/api/client";

/** Nombres de los feature flags: deben coincidir con `FeatureFlagCatalog` del backend. */
export const FEATURE_FLAGS = {
  QuinielaMultipleTickets: "QuinielaMultipleTickets",
} as const;

export type FeatureFlagName = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export type FeatureFlags = Partial<Record<FeatureFlagName, boolean>>;

export async function getFeatureFlags(): Promise<FeatureFlags> {
  const res = await client.get("/api/feature-flags", { suppressErrorRedirect: true });
  return res.data as FeatureFlags;
}
