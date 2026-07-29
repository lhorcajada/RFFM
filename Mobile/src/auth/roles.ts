import { jwtDecode } from 'jwt-decode';

interface DecodedToken {
  roles?: string[];
}

export function getRolesFromToken(token: string | null): string[] {
  if (!token) return [];
  try {
    const decoded = jwtDecode<DecodedToken>(token);
    return decoded.roles ?? [];
  } catch {
    return [];
  }
}
