export interface TacticalPrinciple {
  id: number;
  name: string;
}

export interface EssentialSkill {
  id: number;
  name: string;
  description: string;
}

export interface SubSubPrinciple {
  id: number;
  order: number;
  name: string;
  /** Acción: description of the player's action */
  action: string;
  essentialSkills: EssentialSkill[];
}

export interface SubPrinciple {
  id: number;
  order: number;
  /** e.g. "A", "B", "1", "2" — identifier/letter used in the label */
  label: string;
  name: string;
  context: string;
  tacticalPrinciples: TacticalPrinciple[];
  subSubPrinciples: SubSubPrinciple[];
}

export interface Scenario {
  id: number;
  order: number;
  name: string;
  context: string;
  tacticalPrinciples: TacticalPrinciple[];
  subPrinciples: SubPrinciple[];
}

export interface Zone {
  id: number;
  name: string;
  scenarios: Scenario[];
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
