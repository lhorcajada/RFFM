import { client } from "../../core/api/client";

export type AppVersion = {
  version: string;
  commit: string | null;
};

export function getWebVersion(): AppVersion {
  return {
    version: import.meta.env.VITE_APP_VERSION || "0.0.0",
    commit: import.meta.env.VITE_APP_COMMIT || null,
  };
}

export async function getApiVersion(): Promise<AppVersion> {
  const res = await client.get("/api/version", { suppressErrorRedirect: true });
  return res.data as AppVersion;
}

export function formatVersion({ version, commit }: AppVersion): string {
  return commit ? `v${version} (${commit})` : `v${version}`;
}
