export type NotifySeverity = "success" | "error" | "info" | "warning";

export function notify(message: string, severity: NotifySeverity) {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }));
}
