/**
 * The one-time password returned by `POST /api/family-members/{id}/register` is never
 * persisted by the backend — it only ever appears once, in that response. This module keeps
 * a client-side copy per family member so the coach can rebuild the WhatsApp message later
 * (after closing the dialog, navigating away, or reloading the player's card) without a
 * second backend call, which does not exist.
 */

const STORAGE_PREFIX = "rffm.familyMemberCredentials.";

export type FamilyMemberCredentials = {
  requestId: string;
  alias: string;
  password: string;
  familyMemberName: string;
  playerName: string;
};

function storageKey(familyMemberId: string): string {
  return `${STORAGE_PREFIX}${familyMemberId}`;
}

export function saveFamilyMemberCredentials(
  familyMemberId: string,
  credentials: FamilyMemberCredentials
): void {
  try {
    localStorage.setItem(storageKey(familyMemberId), JSON.stringify(credentials));
  } catch {
    // localStorage unavailable (private browsing, storage full, etc.) — the dialog shown
    // right after registration is still the coach's chance to copy the message.
  }
}

export function getFamilyMemberCredentials(familyMemberId: string): FamilyMemberCredentials | null {
  try {
    const raw = localStorage.getItem(storageKey(familyMemberId));
    if (!raw) return null;
    return JSON.parse(raw) as FamilyMemberCredentials;
  } catch {
    return null;
  }
}

export function clearFamilyMemberCredentials(familyMemberId: string): void {
  try {
    localStorage.removeItem(storageKey(familyMemberId));
  } catch {
    // Ignore — nothing to clean up if storage is unavailable.
  }
}

export function buildWhatsAppMessage(credentials: FamilyMemberCredentials): string {
  return (
    `Hola ${credentials.familyMemberName}!\n\n` +
    `Ya tienes creada tu cuenta en la app de Fútbol Base para seguir a ${credentials.playerName}.\n\n` +
    `Usuario: ${credentials.alias}\n` +
    `Contraseña: ${credentials.password}\n\n` +
    `¡Un saludo!`
  );
}
