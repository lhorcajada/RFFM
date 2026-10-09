// Excuse type ids (ExcuseTypes in the backend domain).
const INJURY = 1;
const STUDY = 2;
const ILL = 3;
const FAMILY_PROBLEM = 4;
const TECHNICAL_DECISION = 7;
const MEDICAL_APPOINTMENT = 9;
const UNFORESEEN_EVENT = 10;

// Fraction of an event an absence subtracts from the player's attendance.
const ABSENCE_PENALTY_BY_EXCUSE = new Map<number, number>([
  [INJURY, 0],
  [TECHNICAL_DECISION, 0],
  [UNFORESEEN_EVENT, 0.5],
  [FAMILY_PROBLEM, 0.5],
  [STUDY, 0.75],
  [ILL, 0.75],
  [MEDICAL_APPOINTMENT, 0.75],
]);

// Absences that never force a deconvocation on their own, even if the player missed the whole week.
const EXCUSES_NOT_FORCING_DECONVOCATION = new Set([STUDY, FAMILY_PROBLEM, MEDICAL_APPOINTMENT, UNFORESEEN_EVENT]);

export function absencePenalty(excuseTypeId: number | null | undefined): number {
  return excuseTypeId != null ? ABSENCE_PENALTY_BY_EXCUSE.get(excuseTypeId) ?? 1 : 1;
}

export function forcesDeconvocation(excuseTypeId: number | null | undefined): boolean {
  return excuseTypeId == null || !EXCUSES_NOT_FORCING_DECONVOCATION.has(excuseTypeId);
}

// Assistance type ids (AssistanceType) and convocation status ids (ConvocationStatus) in the backend domain.
const ATTENDED_ASSISTANCE_IDS = new Set([1, 4]);
const ABSENT_ASSISTANCE_IDS = new Set([2, 3]);
const JUSTIFIED_STATUS_ID = 4;

export function classifyFriendlyConvocation(convocation: {
  assistanceTypeId?: number | null;
  statusId?: number | null;
}): "attended" | "absent" | null {
  const { assistanceTypeId, statusId } = convocation;
  if (assistanceTypeId != null && ATTENDED_ASSISTANCE_IDS.has(assistanceTypeId)) return "attended";
  if (assistanceTypeId != null && ABSENT_ASSISTANCE_IDS.has(assistanceTypeId)) return "absent";
  if (assistanceTypeId == null && statusId === JUSTIFIED_STATUS_ID) return "absent";
  return null;
}

export function isFriendlyEvent(event: {
  matchCategory?: string | null;
  eventType?: string | null;
  title?: string | null;
  name?: string | null;
}): boolean {
  if (event.matchCategory) return event.matchCategory === "Friendly";
  const eventType = (event.eventType ?? "").toLowerCase();
  const title = (event.title ?? event.name ?? "").toLowerCase();
  return /amist|friendly/.test(eventType) || /amist|friendly/.test(title);
}
