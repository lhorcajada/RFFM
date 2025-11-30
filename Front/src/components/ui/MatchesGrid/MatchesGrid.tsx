import React from "react";
import MatchCard from "../MatchCard/MatchCard";
import styles from "./MatchesGrid.module.css";
import { sortMatchesByTime } from "../../../utils/calendar";
import RestItem from "../RestItem/RestItem";

export default function MatchesGrid({ items }: { items: any[] }) {
  return (
    <div className={styles.matchesGrid}>
      {(items || [])
        .slice()
        .sort(sortMatchesByTime)
        .map((it: any, idx: number) => {
          const m = it.match ?? {};
          const local = String(
            m.equipo_local ?? m.local ?? m.localTeamName ?? m.nombre ?? ""
          )
            .trim()
            .toLowerCase();
          const away = String(
            m.equipo_visitante ??
              m.visitante ??
              m.awayTeamName ??
              m.nombre ??
              ""
          )
            .trim()
            .toLowerCase();

          const isDescansa = local === "descansa" || away === "descansa";
          return isDescansa ? (
            <RestItem key={idx} item={it} />
          ) : (
            <MatchCard key={idx} item={it} />
          );
        })}
    </div>
  );
}
