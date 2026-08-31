import type { NormalizedMatch } from "../types";
import MatchCard from "./MatchCard";
import convStyles from "../Convocations.module.css";
import localStyles from "./AgendaList.module.css";

export default function AgendaList({ matches, onNavigate, isPlayer }:
  { matches: NormalizedMatch[]; onNavigate: (m: NormalizedMatch) => void; isPlayer?: boolean }) {
  const sorted = [...matches].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return null;

  const groups: { date: string; items: NormalizedMatch[] }[] = [];
  for (const m of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.date === m.date) last.items.push(m);
    else groups.push({ date: m.date, items: [m] });
  }

  const formatDate = (iso: string) => {
    const [y, mo, d] = iso.split("-").map(Number);
    const dt = new Date(y, mo - 1, d);
    return dt.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  };

  return (
    <div className={convStyles.agendaSection}>
      {groups.map(({ date, items }) => (
        <div key={date} className={convStyles.agendaGroup}>
          <div className={convStyles.agendaDateLabel}>{formatDate(date)}</div>
          {items.map((match, i) => (
            <MatchCard key={i} match={match} onNavigate={onNavigate} isPlayer={isPlayer} />
          ))}
        </div>
      ))}
    </div>
  );
}
