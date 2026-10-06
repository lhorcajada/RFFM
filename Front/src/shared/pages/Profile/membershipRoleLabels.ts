import type { MembershipRole } from "../../services/profile/profileService";

export const membershipRoleLabels: Record<MembershipRole, string> = {
  Directive: "Directiva",
  Coach: "Entrenador",
  ClubMember: "Miembro del club",
  Player: "Jugador",
  FamilyPlayer: "Familiar",
  Follower: "Seguidor",
};

export function membershipRoleLabel(role: string): string {
  return membershipRoleLabels[role as MembershipRole] ?? role;
}
