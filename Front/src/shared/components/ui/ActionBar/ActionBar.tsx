import React from "react";
import { Box } from "@mui/material";
import styles from "./ActionBar.module.css";

interface ActionBarProps {
  children: React.ReactNode;
}

const ActionBar: React.FC<ActionBarProps> = ({ children }) => (
  <Box className={styles.actionBar}>{children}</Box>
);

export default ActionBar;
