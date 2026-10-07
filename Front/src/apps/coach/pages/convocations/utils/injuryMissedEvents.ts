export type InjuryWindow = { startDate: string; endDate: string };

const day = (value: string) => value.slice(0, 10);

// Trainings count from the injury day (an absence that day is caused by the injury);
// matches only strictly after it, because an injury suffered during a match means it was played.
export function countMissedEventsDuringInjury(
  injury: InjuryWindow,
  trainingAbsenceDays: string[],
  matchDays: string[],
): number {
  const start = day(injury.startDate);
  const end = day(injury.endDate);
  const missedTrainings = trainingAbsenceDays.map(day).filter((d) => d >= start && d < end).length;
  const missedMatches = matchDays.map(day).filter((d) => d > start && d < end).length;
  return missedTrainings + missedMatches;
}
