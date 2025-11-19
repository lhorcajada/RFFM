import React from "react";
import { List, Typography } from "@mui/material";
import styles from "./PlayersContainer.module.css";
import teamStyles from "../../../styles/TeamCard.module.css";

type Props = {
  title?: React.ReactNode;
  count?: React.ReactNode;
  listClassName?: string;
  children?: React.ReactNode;
};

const PlayersContainer: React.FC<Props> = ({
  title = "Plantilla",
  count = 0,
  listClassName,
  children,
}) => {
  return (
    <div className={styles.playersBox}>
      <div className={styles.header}>
        <div className={teamStyles.titleWrap}>
          <Typography className={teamStyles.subtitle}>{title}</Typography>
        </div>
        <div className={styles.countWrap}>
          <span className={styles.playersCountChip}>({count})</span>
        </div>
      </div>
      <List className={styles.list}>{children}</List>
    </div>
  );
};

export default PlayersContainer;
