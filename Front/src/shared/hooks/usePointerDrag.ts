import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

const DRAG_THRESHOLD_PX = 5;
const IGNORED_TARGETS = "button, input, textarea, select, a, [data-drag-ignore]";

type PointerDragOptions<P> = {
  /** Touch only: hold this long before a drag can start, so the page can still scroll. */
  touchHoldMs?: number;
  onMove?: (payload: P, clientX: number, clientY: number) => void;
  onStart?: (payload: P) => void;
  onDrop?: (payload: P, clientX: number, clientY: number) => void;
  onEnd?: (payload: P, clientX: number, clientY: number, completed: boolean) => void;
};

type BindOptions = { disabled?: boolean };

type DragBinding = {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
};

type Session<P> = {
  payload: P;
  source: HTMLElement;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  started: boolean;
  armed: boolean;
  holdTimer: ReturnType<typeof setTimeout> | null;
  ghost: HTMLElement | null;
  grabOffsetX: number;
  grabOffsetY: number;
};

const createGhost = (source: HTMLElement, x: number, y: number) => {
  const rect = source.getBoundingClientRect();
  const ghost = source.cloneNode(true) as HTMLElement;
  ghost.setAttribute("data-pointer-drag-ghost", "");
  ghost.removeAttribute("id");
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    transform: "none",
    opacity: "0.8",
    pointerEvents: "none",
    zIndex: "2000",
  });
  document.body.appendChild(ghost);
  return { ghost, grabOffsetX: x - rect.left, grabOffsetY: y - rect.top };
};

/**
 * Drag with Pointer Events instead of native HTML5 drag&drop. Native drag can get
 * stuck at browser level; here every drag ends on pointerup, pointercancel or Escape,
 * and the listeners/ghost are always torn down.
 */
export function usePointerDrag<P>({ onStart, onDrop, onEnd, onMove: onMoveCb, touchHoldMs = 0 }: PointerDragOptions<P>) {
  const [dragging, setDragging] = useState<P | null>(null);
  const handlers = useRef({ onStart, onDrop, onEnd, onMove: onMoveCb, touchHoldMs });
  handlers.current = { onStart, onDrop, onEnd, onMove: onMoveCb, touchHoldMs };
  const cleanupRef = useRef<(() => void) | null>(null);
  const releaseClickBlockRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  const bindDrag = useCallback(
    (payload: P, { disabled = false }: BindOptions = {}): DragBinding => ({
      onPointerDown: (e) => {
        if (disabled || e.button !== 0) return;
        const source = e.currentTarget;
        const target = e.target as Element;
        const ignored = target.closest(IGNORED_TARGETS);
        if (ignored && ignored !== source && source.contains(ignored)) return;

        cleanupRef.current?.();
        releaseClickBlockRef.current?.();

        const session: Session<P> = {
          payload,
          source,
          startX: e.clientX,
          startY: e.clientY,
          lastX: e.clientX,
          lastY: e.clientY,
          started: false,
          armed: true,
          holdTimer: null,
          ghost: null,
          grabOffsetX: 0,
          grabOffsetY: 0,
        };

        const holdMs = e.pointerType === "touch" ? handlers.current.touchHoldMs : 0;
        if (holdMs > 0) {
          session.armed = false;
          session.holdTimer = setTimeout(() => {
            session.armed = true;
          }, holdMs);
        }

        const blockScroll = (ev: TouchEvent) => {
          if (session.armed && ev.cancelable) ev.preventDefault();
        };

        const teardown = () => {
          if (session.holdTimer) clearTimeout(session.holdTimer);
          window.removeEventListener("touchmove", blockScroll);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onCancel);
          window.removeEventListener("keydown", onKey, true);
          session.ghost?.remove();
          session.ghost = null;
          document.body.style.userSelect = "";
          cleanupRef.current = null;
        };

        const swallowNextClick = () => {
          const block = (ev: Event) => {
            ev.stopImmediatePropagation();
            ev.preventDefault();
          };
          const release = () => {
            window.removeEventListener("click", block, true);
            releaseClickBlockRef.current = null;
          };
          window.addEventListener("click", block, true);
          releaseClickBlockRef.current = release;
          setTimeout(release, 0);
        };

        const finish = (completed: boolean, x: number, y: number) => {
          const wasStarted = session.started;
          teardown();
          if (!wasStarted) return;
          setDragging(null);
          swallowNextClick();
          if (completed) handlers.current.onDrop?.(session.payload, x, y);
          handlers.current.onEnd?.(session.payload, x, y, completed);
        };

        const onMove = (ev: PointerEvent) => {
          session.lastX = ev.clientX;
          session.lastY = ev.clientY;
          if (!session.started) {
            const moved = Math.hypot(ev.clientX - session.startX, ev.clientY - session.startY);
            if (moved < DRAG_THRESHOLD_PX) return;
            if (!session.armed) {
              teardown();
              return;
            }
            session.started = true;
            const created = createGhost(session.source, session.startX, session.startY);
            session.ghost = created.ghost;
            session.grabOffsetX = created.grabOffsetX;
            session.grabOffsetY = created.grabOffsetY;
            document.body.style.userSelect = "none";
            setDragging(session.payload);
            handlers.current.onStart?.(session.payload);
          }
          handlers.current.onMove?.(session.payload, ev.clientX, ev.clientY);
          if (session.ghost) {
            session.ghost.style.left = `${ev.clientX - session.grabOffsetX}px`;
            session.ghost.style.top = `${ev.clientY - session.grabOffsetY}px`;
          }
        };
        const onUp = (ev: PointerEvent) => finish(true, ev.clientX, ev.clientY);
        const onCancel = () => finish(false, session.lastX, session.lastY);
        const onKey = (ev: KeyboardEvent) => {
          if (ev.key === "Escape") finish(false, session.lastX, session.lastY);
        };

        window.addEventListener("touchmove", blockScroll, { passive: false });
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onCancel);
        window.addEventListener("keydown", onKey, true);
        cleanupRef.current = teardown;
      },
    }),
    [],
  );

  return { bindDrag, dragging };
}
