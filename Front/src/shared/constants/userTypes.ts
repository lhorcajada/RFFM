export type UserType =
  | "Coach"
  | "ClubDirector"
  | "Player"
  | "FamilyMember"
  | "Fan"
  | "ClubMember";

export interface UserTypeOption {
  value: UserType;
  label: string;
}

export const USER_TYPE_OPTIONS: UserTypeOption[] = [
  { value: "ClubDirector", label: "Directivo de club" },
  { value: "Coach", label: "Entrenador" },
  { value: "Player", label: "Jugador" },
  { value: "FamilyMember", label: "Familiar de jugador" },
  { value: "Fan", label: "Seguidor" },
  { value: "ClubMember", label: "Miembro de club" },
];
