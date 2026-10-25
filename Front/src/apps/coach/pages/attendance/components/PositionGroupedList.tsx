import React from "react";
import { sortByPosition } from "../utils/positionGroups";
import styles from "./PositionGroupedList.module.css";

type Props<T> = {
  items: T[];
  getPosition: (item: T) => string | null | undefined;
  renderItem: (item: T) => React.ReactNode;
};

export default function PositionGroupedList<T>({ items, getPosition, renderItem }: Props<T>) {
  return <ul className={styles.list}>{sortByPosition(items, getPosition).map(renderItem)}</ul>;
}
