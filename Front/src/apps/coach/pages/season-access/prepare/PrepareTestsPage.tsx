import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import ErrorBoundary from "../../../../../shared/components/ui/ErrorBoundary/ErrorBoundary";
import useSeasonAccess from "../hooks/useSeasonAccess";
import usePrepareTests from "./hooks/usePrepareTests";
import { upsertSeasonPrepAllTeams, getSeasonPrepAllTeams } from "../../../../coach/services/seasonPrepAllTeamsService";
import PlayerList from "./components/PlayerList/PlayerList";
import FieldWithBench from "./components/FieldWithBench/FieldWithBench";
import styles from "./PrepareTestsPage.module.css";
import { Box, Button, CircularProgress, MenuItem, Select, Tab, Tabs, Typography, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from "@mui/material";
import ConfirmDialog from "../../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { getFormations } from "../../../services/formationService";
import { FORMATION_POSITIONS } from "../../../types/formation";
import type { SeasonAccessTrialPlayerDto } from "../../../services/seasonAccessService";

type SimSlotPlayer = {
  teamPlayerId: string;
  displayName: string;
  alias?: string | null;
  photoSrc?: string | null;
  dorsal?: number | null;
  competitiveness?: number | null;
  primaryPosition?: string | null;
  possiblePositions?: string[];
  teamName?: string | null;
};

export default function PrepareTestsPage() {
  const { demarcations, activeSeason, selectedCategory } = useSeasonAccess();
  const { days, loadingDays, selectedDayIndex, setSelectedDayIndex, ratings, loadingRatings, reloadRatings } = usePrepareTests(activeSeason?.id ?? null, selectedCategory ?? null);
  const navigate = useNavigate();
  const location = useLocation();

  const [formations, setFormations] = useState<Array<{ id: string; name: string; displayName?: string }>>([]);
  const [formationId, setFormationId] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    getFormations().then((list) => {
      if (!mounted) return;
      setFormations(list || []);
      if (list && list.length > 0 && !formationId) setFormationId(list[0].id);
    }).catch(() => {}).finally(() => { mounted = false; });
  }, []);

  const formationName = useMemo(() => {
    const f = formations.find((x) => x.id === formationId);
    return f ? f.name : formations[0]?.name ?? "4-2-3-1";
  }, [formations, formationId]);

  const slotDefs = useMemo(() => FORMATION_POSITIONS[formationName] ?? [], [formationName]);

  // players mapping
  const playersById = useMemo<Record<string, SimSlotPlayer>>(() => {
    const m: Record<string, SimSlotPlayer> = {};
    const demMap: Record<number, string> = {};
    for (const d of demarcations || []) demMap[d.id] = d.name;

    for (const r of ratings) {
      const id = String(r.id);
      const primary = r.idealDemarcationId ? demMap[r.idealDemarcationId] ?? null : null;
      const possibles = (r.possibleDemarcationIds ?? []).map((pid) => demMap[pid]).filter(Boolean) as string[];
      m[id] = {
        teamPlayerId: id,
        displayName: r.playerName ?? r.federationPlayerCode ?? id,
        competitiveness: r.score != null ? Number(r.score) : null,
        primaryPosition: primary,
        possiblePositions: possibles,
        teamName: r.teamName ?? r.teamCode ?? null,
      };
    }
    return m;
  }, [ratings]);

  // Tabs: Equipo 1..2
  const tabCount = 2;
  const [activeTab, setActiveTab] = useState(0);
  const [fieldHeight, setFieldHeight] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [navConfirmOpen, setNavConfirmOpen] = useState(false);
  const pendingNavRef = React.useRef<string | null>(null);
  const pendingNavTypeRef = React.useRef<'link' | 'back' | 'pop' | null>(null);
  const lastSavedJsonRef = React.useRef<string | null>(null);
  const locationRef = React.useRef<string>(window.location.pathname + window.location.search + window.location.hash);

  // tabs data holds slots and bench per tab
  type TabData = { slots: Record<number, string | null>; bench: string[] };
  const [tabsData, setTabsData] = useState<TabData[]>(() => Array.from({ length: tabCount }, () => ({ slots: {}, bench: [] })));

  const usedTabById = useMemo(() => {
    const m: Record<string, number> = {};
    for (let t = 0; t < tabsData.length; t++) {
      const td = tabsData[t];
      for (const k of Object.keys(td.slots)) {
        const v = td.slots[Number(k)];
        if (v) m[String(v)] = t;
      }
      for (const b of td.bench) {
        if (b) m[String(b)] = t;
      }
    }
    return m;
  }, [tabsData]);

  const usedLocationById = useMemo(() => {
    const map: Record<string, { tab: number; type: 'slot' | 'bench'; slotIndex?: number }> = {};
    for (let t = 0; t < tabsData.length; t++) {
      const td = tabsData[t];
      for (const k of Object.keys(td.slots)) {
        const v = td.slots[Number(k)];
        if (v) map[String(v)] = { tab: t, type: 'slot', slotIndex: Number(k) };
      }
      for (const b of td.bench) {
        if (b) map[String(b)] = { tab: t, type: 'bench' };
      }
    }
    return map;
  }, [tabsData]);

  // initial fill of benches from ratings when load
  // Note: benches start empty by default. Do not auto-fill benches from ratings.

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }));
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  function buildSessionJson() {
    const sessionState = {
      fedSeason: activeSeason?.id ?? null,
      sportEventId: days[selectedDayIndex]?.id ?? null,
      slot: {
        formationId: formationId || null,
        formation: formationName,
        activeTab,
        tabs: tabsData,
      },
      pool: Object.values(playersById),
      activeTab,
      formationId: formationId || null,
      formationName: formationName || null,
      selectedDayIndex: selectedDayIndex ?? null,
    };
    try {
      return JSON.stringify(sessionState);
    } catch {
      return JSON.stringify({});
    }
  }

  async function saveSession(): Promise<boolean> {
    if (!activeSeason?.id) {
      try { window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message: 'No hay temporada activa para guardar.', severity: 'warning' } })); } catch {}
      return false;
    }
    setSaving(true);
    try {
      const sessionState = {
        fedSeason: activeSeason.id,
        sportEventId: days[selectedDayIndex]?.id ?? null,
        slot: {
          formationId: formationId || null,
          formation: formationName,
          activeTab,
          tabs: tabsData,
        },
        pool: Object.values(playersById),
        activeTab,
        formationId: formationId || null,
        formationName: formationName || null,
        selectedDayIndex: selectedDayIndex ?? null,
      } as const;

      await upsertSeasonPrepAllTeams(sessionState as any);
      lastSavedJsonRef.current = buildSessionJson();
      try { window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message: 'Preparación guardada.', severity: 'success' } })); } catch {}
      return true;
    } catch (err) {
      try { window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message: 'Error al guardar la preparación.', severity: 'error' } })); } catch {}
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function performSave() {
    const ok = await saveSession();
    setConfirmOpen(false);
    return ok;
  }

  async function exportPdf() {
    if (!activeSeason?.id) {
      try { window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message: 'No hay temporada activa para exportar.', severity: 'warning' } })); } catch {}
      return;
    }
    setExporting(true);
    try {
      const sessionState = {
        fedSeason: activeSeason.id,
        sportEventId: days[selectedDayIndex]?.id ?? null,
        slot: {
          formationId: formationId || null,
          formation: formationName,
          activeTab,
          tabs: tabsData,
        },
        pool: Object.values(playersById),
        activeTab,
        formationId: formationId || null,
        formationName: formationName || null,
        selectedDayIndex: selectedDayIndex ?? null,
      } as const;

      // Generate one PDF per team (Equipo 1 y Equipo 2)
      for (let teamIdx = 0; teamIdx < 2; teamIdx++) {
        try {
          const blob = await import("../../../../coach/services/seasonPrepAllTeamsService").then(m => m.exportSeasonPrepAllTeams(sessionState as any, { templateMode: false, ratingsMode: true, saveBeforeExport: false, teamIndex: teamIdx }));
          const url = window.URL.createObjectURL(blob as Blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Valoraciones_Equipo_${teamIdx + 1}_${(new Date()).toISOString().replace(/[:.]/g, "_")}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        } catch (err) {
          // continue with next team
        }
      }
      try { window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message: 'PDFs descargados.', severity: 'success' } })); } catch {}
    } catch (err) {
      try { window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message: 'Error al exportar PDF.', severity: 'error' } })); } catch {}
    } finally {
      setExporting(false);
    }
  }

  async function printTemplate() {
    if (!activeSeason?.id) {
      try { window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message: 'No hay temporada activa para imprimir.', severity: 'warning' } })); } catch {}
      return;
    }
    setPrinting(true);
    try {
      const sessionState = {
        fedSeason: activeSeason.id,
        sportEventId: days[selectedDayIndex]?.id ?? null,
        slot: {
          formationId: formationId || null,
          formation: formationName,
          activeTab,
          tabs: tabsData,
        },
        pool: Object.values(playersById),
        activeTab,
        formationId: formationId || null,
        formationName: formationName || null,
        selectedDayIndex: selectedDayIndex ?? null,
      } as const;

      // Generate and download one PDF per team (Equipo 1 and Equipo 2)
      for (let teamIdx = 0; teamIdx < 2; teamIdx++) {
        try {
          const blob = await import("../../../../coach/services/seasonPrepAllTeamsService").then(m => m.exportSeasonPrepAllTeams(sessionState as any, { templateMode: false, listMode: true, saveBeforeExport: false, teamIndex: teamIdx }));
          const url = window.URL.createObjectURL(blob as Blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Lista_Jugadores_Equipo_${teamIdx + 1}_${(new Date()).toISOString().replace(/[:.]/g, "_")}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        } catch (err) {
          // continue with next team
        }
      }
    } catch (err) {
      try { window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message: 'Error al imprimir plantilla.', severity: 'error' } })); } catch {}
    } finally {
      setPrinting(false);
    }
  }

  function resetTeams() {
    setTabsData(() => Array.from({ length: tabCount }, () => ({ slots: {}, bench: [] } as TabData)));
    setActiveTab(0);
    setResetConfirmOpen(false);
  }
  

  function findPlayerLocation(pid: string) {
    for (let t = 0; t < tabsData.length; t++) {
      const td = tabsData[t];
      for (const k of Object.keys(td.slots)) {
        if (td.slots[Number(k)] === pid) return { tab: t, type: 'slot' as const, slotIndex: Number(k) };
      }
      const bi = td.bench.findIndex((x) => x === pid);
      if (bi >= 0) return { tab: t, type: 'bench' as const, benchIndex: bi };
    }
    return null;
  }

  function removePlayerFromAllTabs(pid: string) {
    setTabsData((prev) => prev.map((td) => ({ slots: Object.fromEntries(Object.entries(td.slots).map(([k, v]) => [k, v === pid ? null : v])), bench: td.bench.filter((b) => b !== pid) })));
  }

  function handleDragStart(event: DragStartEvent) {
    const aid = String(event.active.id ?? "");
    setActiveDragId(aid.startsWith("sim-player-") ? aid.replace(/^sim-player-/, "") : aid);
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id ?? "");
    const overId = String(event.over?.id ?? "");
    setActiveDragId(null);
    if (!activeId.startsWith("sim-player-")) return;
    const pid = activeId.replace("sim-player-", "");

    // drop back to list
    if (overId === "prep-list") {
      // remove from any slot/bench
      removePlayerFromAllTabs(pid);
      return;
    }

    // drop to bench of active tab
    if (overId === `sim-bench-prep-${activeTab}`) {
      setTabsData((prev) => {
        const next = prev.map((td) => ({ slots: { ...td.slots }, bench: td.bench.filter((b) => b !== pid) }));
        // ensure player removed from any slot
        for (const td of next) {
          for (const k of Object.keys(td.slots)) {
            if (td.slots[Number(k)] === pid) td.slots[Number(k)] = null;
          }
        }
        // add to active bench if not present
        if (!next[activeTab].bench.includes(pid)) next[activeTab].bench.push(pid);
        return next;
      });
      return;
    }

    // drop to a field slot (pattern: sim-slot-prep-<tab>-<slotIndex>)
    const slotPrefix = `sim-slot-prep-${activeTab}-`;
    if (overId.startsWith(slotPrefix)) {
      const slotIndexStr = overId.substring(slotPrefix.length);
      const slotIndex = Number(slotIndexStr);
      if (Number.isNaN(slotIndex)) return;

      setTabsData((prev) => {
        const next = prev.map((td) => ({ slots: { ...td.slots }, bench: td.bench.filter((b) => b !== pid) }));

        // remove player from any slot it occupied previously
        for (const td of next) {
          for (const k of Object.keys(td.slots)) {
            if (td.slots[Number(k)] === pid) td.slots[Number(k)] = null;
          }
        }

        // swap if target occupied
        const occupant = next[activeTab].slots[slotIndex] ?? null;
        next[activeTab].slots[slotIndex] = pid;
        if (occupant) {
          // put occupant into bench if not present
          if (!next[activeTab].bench.includes(occupant)) next[activeTab].bench.push(occupant);
        }

        return next;
      });
      return;
    }
  }

  const onTabChange = (_: any, v: number) => setActiveTab(v);

  // Load saved session (if any) and track last saved snapshot
  useEffect(() => {
    let mounted = true;
    async function loadSession() {
      try {
        const sportEventId = days[selectedDayIndex]?.id ?? null;
        const session = await getSeasonPrepAllTeams(sportEventId);
        if (!mounted) return;
        if (session) {
          setFormationId(session.formationId ?? "");
          const rawActive = session.activeTab ?? 0;
          const clampedActive = typeof rawActive === 'number' && rawActive >= 0 && rawActive < tabCount ? rawActive : 0;
          setActiveTab(clampedActive);
          const rawTabs = Array.isArray(session.slot?.tabs) ? session.slot!.tabs : [];
          const sliced = rawTabs.slice(0, tabCount);
          while (sliced.length < tabCount) sliced.push({ slots: {}, bench: [] } as any);
          setTabsData(sliced);
          if (typeof session.selectedDayIndex === "number") setSelectedDayIndex(session.selectedDayIndex);
          const normalized = { ...session, slot: { ...(session.slot ?? {}), tabs: sliced } };
          lastSavedJsonRef.current = JSON.stringify(normalized);
        } else {
          lastSavedJsonRef.current = buildSessionJson();
        }
      } catch {
        lastSavedJsonRef.current = buildSessionJson();
      }
      // update location ref
      locationRef.current = location.pathname + location.search + location.hash;
    }
    loadSession();
    return () => { mounted = false; };
  }, [activeSeason?.id, days.length]);

  const isDirty = React.useMemo(() => {
    const current = buildSessionJson();
    return lastSavedJsonRef.current !== current;
  }, [formationName, tabsData, playersById, days, selectedDayIndex, activeSeason?.id]);

  // beforeunload (refresh/close)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
      return undefined;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  async function handleNavDiscard() {
    setNavConfirmOpen(false);
    const dest = pendingNavRef.current;
    const type = pendingNavTypeRef.current;
    pendingNavRef.current = null;
    pendingNavTypeRef.current = null;
    if (type === 'back') {
      navigate(-1);
      return;
    }
    if (dest) {
      navigate(dest);
    }
  }

  async function handleNavSaveAndLeave() {
    // perform save, then navigate
    const ok = await saveSession();
    const dest = pendingNavRef.current;
    const type = pendingNavTypeRef.current;
    pendingNavRef.current = null;
    pendingNavTypeRef.current = null;
    setNavConfirmOpen(false);
    if (!ok) return; // keep user on page if save failed
    if (type === 'back') {
      navigate(-1);
      return;
    }
    if (dest) navigate(dest);
  }

  function openNavConfirm() {
    try {
      // blur any focused element so it won't remain inside aria-hidden content
      const ae = document.activeElement as HTMLElement | null;
      if (ae && typeof ae.blur === "function") ae.blur();
    } catch {
      // ignore
    }
    // open on next tick to ensure blur processed
    setTimeout(() => setNavConfirmOpen(true), 0);
  }

  // intercept internal link clicks
  useEffect(() => {
    const handleDocClick = (ev: MouseEvent) => {
      try {
        if (ev.defaultPrevented) return;
        if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
        const target = ev.target as Element | null;
        if (!target) return;
        const anchor = target.closest("a") as HTMLAnchorElement | null;
        if (!anchor) return;
        const href = anchor.getAttribute("href");
        if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || anchor.target === "_blank") return;
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return; // external link
        const dest = url.pathname + url.search + url.hash;
        if (dest === locationRef.current) return; // same page

        if (isDirty) {
          ev.preventDefault();
          pendingNavRef.current = dest;
          pendingNavTypeRef.current = 'link';
          openNavConfirm();
        }
      } catch {
        // ignore
      }
    };
    document.addEventListener("click", handleDocClick, true);
    return () => document.removeEventListener("click", handleDocClick, true);
  }, [isDirty]);

  // popstate (back/forward buttons)
  useEffect(() => {
    const handlePop = () => {
      const popped = window.location.pathname + window.location.search + window.location.hash;
      if (isDirty) {
        // revert URL to previous
        history.pushState(null, "", locationRef.current);
        pendingNavRef.current = popped;
        pendingNavTypeRef.current = 'pop';
        openNavConfirm();
      } else {
        locationRef.current = popped;
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [isDirty]);


  return (
    <BaseLayout hideFooterMenu>
      <ErrorBoundary>
        <ContentLayout
          title="Preparación de la prueba"
          subtitle="Organiza equipo y variantes"
          actionBar={(
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="small" onClick={() => {
                  if (!isDirty) return navigate(-1);
                  pendingNavRef.current = null;
                  pendingNavTypeRef.current = 'back';
                  setNavConfirmOpen(true);
                }} variant="outlined">Volver</Button>
                <Button size="small" onClick={() => void reloadRatings()} variant="outlined">Recargar jugadores</Button>
                <Button size="small" variant="outlined" onClick={() => setResetConfirmOpen(true)}>Reiniciar equipos</Button>
                <div style={{ width: 8 }} />
                <Button size="small" color="primary" variant="outlined" onClick={() => void printTemplate()} disabled={printing}>
                  {printing ? <CircularProgress size={16} color="inherit" /> : "Lista de jugadores"}
                </Button>
                <Button size="small" color="primary" variant="outlined" onClick={() => void exportPdf()} disabled={exporting}>
                  {exporting ? <CircularProgress size={16} color="inherit" /> : "Valoraciones PDF"}
                </Button>
              </div>

              <div style={{ marginLeft: 'auto' }}>
                <Button size="small" color="primary" variant="contained" onClick={() => setConfirmOpen(true)} disabled={saving}>
                  {saving ? <CircularProgress size={16} color="inherit" /> : "Guardar"}
                </Button>
              </div>
            </div>
          )}
        >
          <div className={styles.page}>
            <div className={styles.tabsBar}>
              <Tabs value={activeTab} onChange={onTabChange} variant="standard">
                {Array.from({ length: tabCount }).map((_, i) => (
                  <Tab key={i} label={`Equipo ${i + 1}`} />
                ))}
              </Tabs>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <Select value={formationId} onChange={(e) => setFormationId(String(e.target.value))} size="small" className={styles.formationSelect}>
                  {formations.map((f) => (
                    <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
                  ))}
                </Select>
              </div>
            </div>

            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDragId(null)}>
              <div className={styles.content}>
                <div className={styles.leftCol}>
                  {(loadingDays || loadingRatings) ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={20} /></Box>
                  ) : (
                    <PlayerList players={ratings} demarcations={demarcations} fieldHeight={fieldHeight} maxHeight={600} activeTab={activeTab} usedTabById={usedTabById} usedLocationById={usedLocationById} activeDragId={activeDragId} />
                  )}
                </div>

                <div className={styles.rightCol}>
                  <FieldWithBench tabIndex={activeTab} slotDefs={slotDefs} slots={tabsData[activeTab]?.slots ?? {}} bench={tabsData[activeTab]?.bench ?? []} playersById={playersById} onFieldHeight={setFieldHeight} maxHeight={fieldHeight ?? 600} activeTab={activeTab} usedTabById={usedTabById} />
                </div>
              </div>

              <DragOverlay>
                {activeDragId ? (
                  (() => {
                    const p = playersById[activeDragId];
                    const name = p?.displayName ?? activeDragId ?? "";
                    const initials = name
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => (w[0] ?? ""))
                      .join("")
                      .toUpperCase();
                    return (
                      <div className={styles.dragOverlay}>
                        <span className={styles.dragOverlayInitials}>{initials}</span>
                      </div>
                    );
                  })()
                ) : null}
              </DragOverlay>
            </DndContext>
            <ConfirmDialog
              open={confirmOpen}
              title="Guardar preparación"
              description="Esto sobrescribirá la preparación guardada previamente para este día. ¿Deseas continuar?"
              confirmText="Guardar"
              cancelText="Cancelar"
              processing={saving}
              onCancel={() => setConfirmOpen(false)}
              onConfirm={() => void performSave()}
            />
            <ConfirmDialog
              open={resetConfirmOpen}
              title="Reiniciar equipos"
              description="Esto vaciará las plantillas de los equipos y el banquillo. ¿Deseas continuar?"
              confirmText="Reiniciar"
              cancelText="Cancelar"
              processing={false}
              onCancel={() => setResetConfirmOpen(false)}
              onConfirm={() => resetTeams()}
            />
            <Dialog open={navConfirmOpen} onClose={() => setNavConfirmOpen(false)}>
              <DialogTitle>Salir de la página</DialogTitle>
              <DialogContent>
                <DialogContentText>
                  Tienes cambios sin guardar. ¿Qué quieres hacer?
                </DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setNavConfirmOpen(false)} color="inherit">Cancelar</Button>
                <Button onClick={() => void handleNavDiscard()} color="inherit">Descartar cambios</Button>
                <Button autoFocus onClick={() => void handleNavSaveAndLeave()} variant="contained" color="primary">Guardar y salir</Button>
              </DialogActions>
            </Dialog>
          </div>
        </ContentLayout>
      </ErrorBoundary>
    </BaseLayout>
  );
}
