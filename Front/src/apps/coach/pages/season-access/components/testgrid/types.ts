export type Status = 'descartado' | 'poco' | 'interesado' | 'solicitado' | 'seleccionado';

export interface Demarcation {
  id: number;
  name: string;
  code: string;
}

export interface Player {
  id: number;
  trialPlayerId?: string;
  federationPlayerCode?: string;
  teamCode?: string;
  name: string;
  birthYear: number;
  teamName?: string;
  category?: string;
  status: Status;
  rating: number;
  idealDemarcationId?: number | null;
  possibleDemarcationIds?: number[];
  totalGoals?: number | null;
}
