import React from "react";
import { groupByPosition } from "../utils/positionGroups";
import styles from "./PositionGroupedList.module.css";

type Props<T> = {
  items: T[];
  getPosition: (item: T) => string | null | undefined;
  renderItem: (item: T) => React.ReactNode;
  listClassName?: string;
};

export default function PositionGroupedList<T>({ items, getPosition, renderItem, listClassName }: Props<T>) {
  const groups = groupByPosition(items, getPosition);

  return (
    <div className={styles.groups}>
      {groups.map((group) => (
        <section key={group.key} className={styles.group} aria-label={group.label}>
          <h4 className={styles.heading}>
            <span>{group.label}</span>
            <span className={styles.count}>{group.items.length}</span>
          </h4>
          <div className={listClassName ?? styles.list}>{group.items.map(renderItem)}</div>
        </section>
      ))}
    </div>
  );
}
