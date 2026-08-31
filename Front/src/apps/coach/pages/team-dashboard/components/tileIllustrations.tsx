/**
 * Small flat-vector "cover" illustrations for LauncherTile — a composed
 * scene (multiple shapes) per feature rather than a single centered icon
 * glyph, standing in for real photography (none exists in the repo for
 * these 13 features). Each fills its LauncherTile's `.cover` band, layered
 * over that tile's gradient background.
 */

const FILL = "rgba(255,255,255,0.95)";
const FILL_SOFT = "rgba(255,255,255,0.55)";
const FILL_FAINT = "rgba(255,255,255,0.28)";

export function UsersManagementIllustration() {
  return (
    <svg viewBox="0 0 100 80" role="presentation">
      <circle cx="38" cy="30" r="14" fill={FILL} />
      <path d="M14 66c2-16 14-24 24-24s22 8 24 24z" fill={FILL} />
      <circle cx="72" cy="46" r="16" fill="none" stroke={FILL_SOFT} strokeWidth="4" />
      <path
        d="M72 38v-5m0 26v-5m8-13h5m-26 0h5m14.9-6.9 3.5-3.5m-19.8 19.8 3.5-3.5m0-12.8-3.5-3.5m19.8 19.8-3.5-3.5"
        stroke={FILL_SOFT}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SquadIllustration() {
  return (
    <svg viewBox="0 0 100 80" role="presentation">
      <circle cx="26" cy="30" r="11" fill={FILL_FAINT} />
      <path d="M8 62c1.5-13 10-19 18-19s16.5 6 18 19z" fill={FILL_FAINT} />
      <circle cx="74" cy="30" r="11" fill={FILL_FAINT} />
      <path d="M56 62c1.5-13 10-19 18-19s16.5 6 18 19z" fill={FILL_FAINT} />
      <circle cx="50" cy="26" r="14" fill={FILL} />
      <path d="M24 66c2-16 14-24 26-24s24 8 26 24z" fill={FILL} />
    </svg>
  );
}

export function EventsIllustration() {
  return (
    <svg viewBox="0 0 100 80" role="presentation">
      <rect x="18" y="16" width="64" height="54" rx="6" fill={FILL} />
      <rect x="18" y="16" width="64" height="14" rx="6" fill={FILL_SOFT} />
      <rect x="30" y="8" width="6" height="14" rx="3" fill={FILL_SOFT} />
      <rect x="64" y="8" width="6" height="14" rx="3" fill={FILL_SOFT} />
      <path
        d="M34 48l9 9 20-20"
        fill="none"
        stroke="#1565c0"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AttendanceSummaryIllustration() {
  return (
    <svg viewBox="0 0 100 80" role="presentation">
      <rect x="14" y="58" width="72" height="4" rx="2" fill={FILL_SOFT} />
      <rect x="20" y="38" width="14" height="20" rx="3" fill={FILL_FAINT} />
      <rect x="43" y="24" width="14" height="34" rx="3" fill={FILL} />
      <rect x="66" y="14" width="14" height="44" rx="3" fill={FILL_SOFT} />
    </svg>
  );
}

export function MatchesIllustration() {
  return (
    <svg viewBox="0 0 100 80" role="presentation">
      <rect x="10" y="14" width="80" height="52" rx="6" fill="none" stroke={FILL_SOFT} strokeWidth="4" />
      <line x1="50" y1="14" x2="50" y2="66" stroke={FILL_SOFT} strokeWidth="3" />
      <circle cx="50" cy="40" r="12" fill="none" stroke={FILL_SOFT} strokeWidth="3" />
      <circle cx="50" cy="40" r="9" fill={FILL} stroke="#2e2e2e" strokeWidth="1.5" />
      <path
        d="M50 33l5 4-2 6h-6l-2-6z"
        fill="#2e2e2e"
      />
    </svg>
  );
}

export function RivalsIllustration() {
  return (
    <svg viewBox="0 0 100 80" role="presentation">
      <rect x="30" y="10" width="5" height="60" rx="2.5" fill={FILL_SOFT} />
      <path d="M35 14h38l-9 12 9 12H35z" fill={FILL} />
      <ellipse cx="32" cy="72" rx="14" ry="4" fill={FILL_FAINT} />
    </svg>
  );
}

export function TrainingsIllustration() {
  return (
    <svg viewBox="0 0 100 80" role="presentation">
      <path d="M28 62l10-34h8l10 34z" fill={FILL} />
      <rect x="24" y="58" width="30" height="6" rx="2" fill={FILL} />
      <rect x="34" y="38" width="10" height="4" fill={FILL_SOFT} />
      <circle cx="74" cy="50" r="11" fill={FILL_SOFT} stroke="#2e2e2e" strokeWidth="1.5" />
      <path d="M18 20c14-6 26-6 40 2" fill="none" stroke={FILL_FAINT} strokeWidth="3" strokeDasharray="2 6" strokeLinecap="round" />
    </svg>
  );
}

export function InjuredIllustration() {
  return (
    <svg viewBox="0 0 100 80" role="presentation">
      <path
        d="M50 12c16 6 26 8 26 8v22c0 16-12 24-26 28-14-4-26-12-26-28V20s10-2 26-8z"
        fill={FILL}
      />
      <rect x="44" y="28" width="12" height="28" rx="2" fill="#ad1457" />
      <rect x="36" y="36" width="28" height="12" rx="2" fill="#ad1457" />
    </svg>
  );
}

export function GameModelIllustration() {
  return (
    <svg viewBox="0 0 100 80" role="presentation">
      <rect x="12" y="12" width="76" height="52" rx="5" fill="none" stroke={FILL_SOFT} strokeWidth="3" />
      <circle cx="28" cy="48" r="4" fill={FILL} />
      <circle cx="50" cy="30" r="4" fill={FILL} />
      <circle cx="74" cy="42" r="4" fill={FILL} />
      <path
        d="M28 48q12-4 22-18t24 12"
        fill="none"
        stroke={FILL}
        strokeWidth="3"
        strokeDasharray="1 7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TeamRulesIllustration() {
  return (
    <svg viewBox="0 0 100 80" role="presentation">
      <rect x="24" y="10" width="52" height="60" rx="4" fill={FILL} />
      <rect x="32" y="22" width="36" height="4" rx="2" fill={FILL_SOFT} />
      <rect x="32" y="32" width="36" height="4" rx="2" fill={FILL_SOFT} />
      <rect x="32" y="42" width="24" height="4" rx="2" fill={FILL_SOFT} />
      <rect x="20" y="10" width="6" height="60" rx="2" fill="#6d4c41" />
    </svg>
  );
}

export function SanctionsIllustration() {
  return (
    <svg viewBox="0 0 100 80" role="presentation">
      <rect x="34" y="8" width="34" height="48" rx="4" fill="#ffca28" transform="rotate(-8 51 32)" />
      <rect x="46" y="20" width="34" height="48" rx="4" fill="#e53935" transform="rotate(10 63 44)" />
    </svg>
  );
}

export function LotteryIllustration() {
  return (
    <svg viewBox="0 0 100 80" role="presentation">
      <path
        d="M14 26a8 8 0 000 16v14a4 4 0 004 4h64a4 4 0 004-4V42a8 8 0 000-16V22a4 4 0 00-4-4H18a4 4 0 00-4 4z"
        fill={FILL}
      />
      <line x1="50" y1="18" x2="50" y2="62" stroke="#f57f17" strokeWidth="3" strokeDasharray="4 5" />
      <path
        d="M64 34l2.3 4.7 5.2.7-3.8 3.6.9 5.2-4.6-2.5-4.6 2.5.9-5.2-3.8-3.6 5.2-.7z"
        fill="#f57f17"
      />
    </svg>
  );
}

export function NewsIllustration() {
  return (
    <svg viewBox="0 0 100 80" role="presentation">
      <rect x="14" y="16" width="72" height="48" rx="3" fill={FILL} />
      <rect x="21" y="23" width="22" height="18" rx="2" fill={FILL_SOFT} />
      <rect x="47" y="24" width="32" height="4" rx="2" fill={FILL_SOFT} />
      <rect x="47" y="32" width="32" height="4" rx="2" fill={FILL_SOFT} />
      <rect x="21" y="46" width="58" height="4" rx="2" fill={FILL_SOFT} />
      <rect x="21" y="54" width="42" height="4" rx="2" fill={FILL_SOFT} />
    </svg>
  );
}

export function SeasonAccessIllustration() {
  return (
    <svg viewBox="0 0 100 80" role="presentation">
      <rect x="18" y="16" width="46" height="52" rx="4" fill={FILL} />
      <path d="M27 30l6 6 12-12" fill="none" stroke="#006064" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="27" y="46" width="28" height="4" rx="2" fill={FILL_SOFT} />
      <rect x="27" y="54" width="20" height="4" rx="2" fill={FILL_SOFT} />
      <circle cx="70" cy="52" r="14" fill="none" stroke={FILL_SOFT} strokeWidth="4" />
      <line x1="80" y1="62" x2="88" y2="70" stroke={FILL_SOFT} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
