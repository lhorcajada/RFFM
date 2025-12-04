import React from "react";
import AppRouter from "./core/router/AppRouter";
import styles from "./App.module.css";

export default function App(): JSX.Element {
  return (
    <div className={styles.app}>
      <main className={styles.main}>
        <AppRouter />
      </main>
    </div>
  );
}
