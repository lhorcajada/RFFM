export interface EssentialSkill {
  id: number;
  /** Backend UUID — use for API calls like mastery toggle */
  apiId?: string;
  name: string;
  description: string;
  masteredAt?: string | null;
  exerciseCount?: number;
}

export interface SubSubPrinciple {
  id: number;
  /** Backend UUID — use for training navigation */
  apiId?: string;
  order: number;
  name: string;
  /** Acción: description of the player's action */
  action: string;
  essentialSkills: EssentialSkill[];
}

export interface SubPrinciple {
  id: number;
  apiId?: string;
  order: number;
  /** e.g. "A", "B", "1", "2" — identifier/letter used in the label */
  label: string;
  name: string;
  context: string;
  subSubPrinciples: SubSubPrinciple[];
}

export interface Scenario {
  id: number;
  apiId?: string;
  order: number;
  name: string;
  context: string;
  subPrinciples: SubPrinciple[];
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | null;
}

export interface Principle {
  id: number;
  apiId?: string;
  gameMomentId: number;
  gameZoneId: number;
  order: number;
  title: string;
  description: string;
  scenarios: Scenario[];
}

export interface Zone {
  id: number;
  name: string;
  principles: Principle[];
}

export interface GameMoment {
  id: number;
  name: string;
  zones: Zone[];
}

export interface GameModel {
  id: string;
  teamId: string;
  name: string;
  season: string;
  gameMoments: GameMoment[];
}
