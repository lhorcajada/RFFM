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

// Directivo de club, Seguidor y Miembro de club están ocultos temporalmente:
// se irán habilitando en próximas versiones del producto.
export const USER_TYPE_OPTIONS: UserTypeOption[] = [
  { value: "Coach", label: "Entrenador" },
  { value: "Player", label: "Jugador" },
  { value: "FamilyMember", label: "Familiar de jugador" },
];
