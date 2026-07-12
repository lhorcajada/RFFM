import client from "../../../core/api/client";

export interface FeaturePermissionDto {
  featureName: string;
  featureRoute: string;
  permissionType: "Read" | "Write" | "ReadWrite";
}

export interface PagePermissionDto {
  pageIdentifier: string;
  permissionKey: string;
  permissionType: "Read" | "Write" | "ReadWrite";
}

export interface MyPermissionsResponse {
  role: string;
  featurePermissions: FeaturePermissionDto[];
  pagePermissions: PagePermissionDto[];
}

export async function getMyPermissions(): Promise<MyPermissionsResponse> {
  const resp = await client.get<MyPermissionsResponse>("/api/permissions/me");
  return resp.data;
}
