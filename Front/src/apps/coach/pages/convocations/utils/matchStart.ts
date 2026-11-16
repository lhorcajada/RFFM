/** True once the kickoff (local date + "HH:mm") has been reached. With no known time the match counts from the start of its day. */
export function hasMatchStarted(date: string, time: string, now: Date = new Date()): boolean {
  if (!date) return false;
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return false;
  const [hours, minutes] = /^\d{1,2}:\d{2}/.test(time) ? time.split(":").map(Number) : [0, 0];
  const kickoff = new Date(year, month - 1, day, hours, minutes);
  return now.getTime() >= kickoff.getTime();
}
