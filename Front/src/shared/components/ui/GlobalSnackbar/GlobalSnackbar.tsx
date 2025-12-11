import React from "react";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Slide from "@mui/material/Slide";
import type { SlideProps } from "@mui/material/Slide";

export default function GlobalSnackbar() {
  const [open, setOpen] = React.useState(false);
  const openRef = React.useRef(open);
  const [snackKey, setSnackKey] = React.useState(0);
  const [message, setMessage] = React.useState("");
  const [severity, setSeverity] = React.useState<
    "info" | "error" | "warning" | "success"
  >("info");

  // Keep ref in sync with state
  React.useEffect(() => {
    openRef.current = open;
  }, [open]);

  const showToastRef = React.useRef<
    ((payloadMessage: string, payloadSeverity: typeof severity) => void) | null
  >(null);

  function showToast(newMessage: string, newSeverity: typeof severity) {
    if (openRef.current) {
      // close current, then reopen a fresh Snackbar (force remount via key)
      setOpen(false);
      requestAnimationFrame(() => {
        setMessage(newMessage);
        setSeverity(newSeverity);
        setSnackKey((prevKey) => prevKey + 1);
        setOpen(true);
      });
    } else {
      setMessage(newMessage);
      setSeverity(newSeverity);
      setSnackKey((prevKey) => prevKey + 1);
      setOpen(true);
    }
  }

  // keep ref to latest showToast so the event listener can call it without stale closure
  React.useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  React.useEffect(() => {
    function onShow(e: any) {
      const detail = e.detail || {};
      const newMessage = detail.message || "";
      const newSeverity = detail.severity || "info";
      const fn = showToastRef.current || showToast;
      fn(newMessage, newSeverity);
    }

    window.addEventListener("rffm.show_snackbar", onShow as EventListener);
    return () =>
      window.removeEventListener("rffm.show_snackbar", onShow as EventListener);
  }, []);

  function TransitionRight(props: SlideProps) {
    return <Slide {...props} direction="left" />;
  }

  return (
    <Snackbar
      key={snackKey}
      open={open}
      autoHideDuration={4000}
      onClose={(_event, reason) => {
        if (reason === "clickaway") return;
        setOpen(false);
      }}
      TransitionProps={{
        onExited: () => {
          setMessage("");
          setSeverity("info");
        },
      }}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      TransitionComponent={TransitionRight}
    >
      <Alert
        onClose={() => setOpen(false)}
        severity={severity}
        sx={{ width: "100%" }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
