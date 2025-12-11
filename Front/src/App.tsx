import React from "react";
import AppRouter from "./core/router/AppRouter";
import GlobalSnackbar from "./shared/components/ui/GlobalSnackbar/GlobalSnackbar";
import styles from "./App.module.css";

export default function App(): JSX.Element {
  return (
    <div className={styles.app}>
      <main className={styles.main}>
        <AppRouter />
        <GlobalSnackbar />
      </main>
    </div>
  );
}
