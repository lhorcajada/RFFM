import { useCallback, useRef, useState, type ReactNode } from "react";
import { DialogContentText, List, ListItem, ListItemText } from "@mui/material";
import ConfirmDialog from "../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import { describeOverflow, type SheetOverflow } from "./sheetMeasure";
import type { OverflowHandler } from "./sessionWindow";

type Pending = { overflowing: SheetOverflow[]; resolve: (printAnyway: boolean) => void };

/** The warning shown before printing sheets that do not fit one page (E13): it lists those exercises
 * with their session block and offers "Editar ejercicio", "Imprimir igualmente" and "Cancelar".
 * `onOverflow` goes into `PrintOptions`; `dialog` must be rendered by the page. No print window
 * opens until the coach has chosen. */
export function usePrintFitGuard(onEditExercise: (exerciseId: string) => void): {
  onOverflow: OverflowHandler;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const onOverflow = useCallback<OverflowHandler>(
    (overflowing) =>
      new Promise<boolean>((resolve) => {
        const next = { overflowing, resolve };
        pendingRef.current = next;
        setPending(next);
      }),
    [],
  );

  const close = (printAnyway: boolean, editFirst = false) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    if (!current) return;
    current.resolve(printAnyway);
    if (editFirst) onEditExercise(current.overflowing[0].exercise.id);
  };

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      title="Hay fichas que no caben en una hoja"
      description={
        <>
          <DialogContentText>
            Estas fichas superan una hoja A4. Si imprimes igualmente, se cortará lo que no quepa. «Editar ejercicio»
            abre el primero de la lista.
          </DialogContentText>
          <List dense disablePadding>
            {(pending?.overflowing ?? []).map(({ exercise, blockName, fit }, index) => (
              <ListItem key={`${exercise.id}-${index}`} disableGutters>
                <ListItemText
                  primary={blockName ? `${exercise.name} · ${blockName}` : exercise.name}
                  secondary={describeOverflow(fit)}
                />
              </ListItem>
            ))}
          </List>
        </>
      }
      confirmText="Imprimir igualmente"
      cancelText="Cancelar"
      secondaryText="Editar ejercicio"
      onCancel={() => close(false)}
      onSecondary={() => close(false, true)}
      onConfirm={() => close(true)}
    />
  );

  return { onOverflow, dialog };
}
