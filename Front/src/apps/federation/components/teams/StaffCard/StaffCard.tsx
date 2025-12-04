import React from "react";
import styles from "./StaffCard.module.css";

type StaffRole = {
  name: string;
  role?: string;
};

type StaffCardProps = {
  title: string;
  staff: StaffRole[];
  titleClassName?: string;
};

export const StaffCard: React.FC<StaffCardProps> = ({
  title,
  staff,
  titleClassName,
}) => {
  if (!staff || staff.length === 0) return null;

  return (
    <aside className={styles.card} aria-label={title}>
      <h3 className={`${styles.title} ${titleClassName ?? ""}`}>{title}</h3>
      <ul className={styles.list}>
        {staff.map((s, i) => (
          <li key={i} className={styles.item}>
            {s.role && <span className={styles.role}>{s.role}</span>}
            <span className={styles.name}>{s.name}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default StaffCard;
