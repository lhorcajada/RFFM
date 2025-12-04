export interface CallupEntry {
  matchDayNumber: number;
  opponent: string;
  called: boolean;
  starter: boolean;
  substitute: boolean;
  home: boolean;
  date: string | Date;
}

export interface PlayerCallupsResponse {
  playerId: string;
  playerName: string;
  callups: CallupEntry[];
}

export type TeamCallupsResponse = PlayerCallupsResponse[];
