import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Box, Button, Tabs, Tab } from "@mui/material";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import convocationService, {
  PlayerSimple,
  ConvocationItem,
} from "../../services/convocationService";
import playerService from "../../services/playerService";
import convocationStatusService from "../../services/convocationStatusService";
import excuseTypeService, {
  ExcuseType,
} from "../../services/excuseTypeService";
import assistanceTypeService, { AssistanceType } from "../../services/assistanceTypeService";
import { coachAuthService } from "../../services/authService";
import styles from "./AttendanceTabs.module.css";
import defaultAvatar from "../../../../assets/avatar.svg";
import NotConvokedList from "./components/NotConvokedList";
import ConvocationCard from "./components/ConvocationCard";
import DeconvokeDialog from "./components/DeconvokeDialog";

type Props = { eventId: string; eventStart?: string | null; isMatch?: boolean };

// A player is injured for a given event only if the injury started BEFORE that day (not same day).
function isInjuredBeforeDate(injuryStartDate: string | null | undefined, eventDate: string | null | undefined): boolean {
  if (!injuryStartDate) return true;
  if (!eventDate) return true;
  return injuryStartDate.slice(0, 10) < eventDate.slice(0, 10);
}

function statusNameMap(id: number, statuses: { id: number; name: string }[]) {
  const s = statuses.find((x) => x.id === id);
  if (!s) return "-";
  const m: Record<string, string> = {
    Pending: "Pendiente",
    Accepted: "Aceptado",
    Deconvoke: "Desconvocado",
  };
  return m[s.name] ?? s.name;
}

export default function AttendanceTabs({ eventId, eventStart, isMatch }: Props) {
  const [tab, setTab] = useState(0);
  const [players, setPlayers] = useState<PlayerSimple[]>([]);
  const [convocations, setConvocations] = useState<ConvocationItem[]>([]);
  const [playerPhotos, setPlayerPhotos] = useState<
    Record<string, string | null>
  >({});
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<{ id: number; name: string }[]>([]);
  const [excuseTypes, setExcuseTypes] = useState<ExcuseType[]>([]);
  const [assistanceTypes, setAssistanceTypes] = useState<AssistanceType[]>([]);
  const [acceptingAll, setAcceptingAll] = useState(false);
  const [settingAllAttends, setSettingAllAttends] = useState(false);

  const canEdit = useMemo(() => {
    if (!eventStart) return true;
    const d = new Date(eventStart);
    if (Date.now() < d.getTime()) return true;
    // After the event date, admins and coaches can still edit
    return coachAuthService.hasRole("Coach");
  }, [eventStart]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [pl, conv, st, ex, at] = await Promise.all([
          convocationService.getEventPlayers(eventId),
          convocationService.getConvocations(eventId),
          convocationStatusService.getConvocationStatuses(),
          excuseTypeService.getExcuseTypes(),
          assistanceTypeService.getAssistanceTypes(),
        ]);
        if (!mounted) return;
        setPlayers(pl);
        setConvocations(conv);
        setStatuses(st);
        setExcuseTypes(ex);
        setAssistanceTypes(at);

        // ── Auto-register injured players as Deconvoke + Lesión ─────────────
        const deconvokeId = st.find((s) => s.name === "Deconvoke")?.id;
        const injuryExcuseId = 1; // ExcuseType id=1 = "Lesión"
        const today = new Date().toISOString().slice(0, 10);
        const eventDay = eventStart ? eventStart.slice(0, 10) : today;

        // Players that are injured (at or before the event date) and not yet
        // registered as Deconvoke+Lesión in this event's convocation list.
        const injuredToRegister = pl.filter((p) => {
          if (!p.isInjured) return false;
          if (!isInjuredBeforeDate(p.injuryStartDate, eventDay)) return false;
          const existing = conv.find((c) => c.player.id === p.id);
          // Already registered as Deconvoke + injury excuse → nothing to do
          if (existing && existing.status === deconvokeId && existing.excuseTypeId === injuryExcuseId) return false;
          return true;
        });

        if (deconvokeId && injuredToRegister.length > 0) {
          for (const p of injuredToRegister.filter((p) => p.id)) {
            try {
              const alreadyInConv = conv.some((c) => c.player.id === p.id);
              if (!alreadyInConv) {
                await convocationService.addConvocation(eventId, p.id!);
              }
              const reloaded = await convocationService.getConvocations(eventId);
              const target = reloaded.find((c) => c.player?.id === p.id);
              if (target) {
                await convocationService.updateConvocationStatus(
                  eventId,
                  target.id,
                  deconvokeId,
                  injuryExcuseId
                );
              }
            } catch {
              // non-blocking: skip if conflict
            }
          }
          // Reload convocations after auto-registration
          const updatedConv = await convocationService.getConvocations(eventId);
          if (!mounted) return;
          setConvocations(updatedConv);
        }
        // ────────────────────────────────────────────────────────────────────

        // fetch photos for players and convocated players
        const photos: Record<string, string | null> = {};
        const all = [
          ...pl.map((p) => ({ id: p.id, url: p.urlPhoto })),
          ...conv.map((c) => ({ id: c.player?.id, url: c.player?.urlPhoto })),
        ];
        await Promise.all(
          all.map(async (it) => {
            const idKey = it.id != null ? String(it.id) : null;
            const urlKey = it.url ? String(it.url) : null;

            if (!it.url) {
              if (idKey) photos[idKey] = null;
              if (urlKey) photos[urlKey] = null;
              return;
            }

            try {
              const obj = await playerService.fetchPlayerPhoto(
                it.url as string
              );
              if (idKey) photos[idKey] = obj;
              if (urlKey) photos[urlKey] = obj;
            } catch (e) {
              if (idKey) photos[idKey] = null;
              if (urlKey) photos[urlKey] = null;
            }
          })
        );
        if (!mounted) return;
        setPlayerPhotos(photos);
      } catch (e) {
        // ignore
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [eventId]);

  const notConvoked = players.filter(
    (p) => !convocations.some((c) => c.player.id === p.id)
  );
  const waitingList = notConvoked.filter((p) => !p.isInjured || !isInjuredBeforeDate(p.injuryStartDate, eventStart));
  const injuredWaiting = notConvoked.filter((p) => p.isInjured && isInjuredBeforeDate(p.injuryStartDate, eventStart));

  const [adding, setAdding] = useState(false);

  const handleAdd = async (playerId?: string) => {
    if (!coachAuthService.hasRole("Coach"))
      return alert("Solo un entrenador puede convocar.");
    if (!canEdit)
      return alert(
        "No se puede editar: el evento ya ha comenzado o está cerrado."
      );
    if (adding) return;
    setAdding(true);
    try {
      if (playerId) await convocationService.addConvocation(eventId, playerId);
      else await convocationService.addConvocationsBulk(eventId);
      const [conv, pl] = await Promise.all([
        convocationService.getConvocations(eventId),
        convocationService.getEventPlayers(eventId),
      ]);
      setConvocations(conv);
      setPlayers(pl);
    } catch (e: any) {
      alert(e?.message ?? "Error al convocar");
    } finally {
      setAdding(false);
    }
  };

  const handleChangeStatus = async (
    conv: ConvocationItem,
    statusId: number,
    excuseTypeId?: number | null
  ) => {
    if (!canEdit)
      return alert(
        "No se puede editar: el evento ya ha comenzado o está cerrado."
      );
    try {
      await convocationService.updateConvocationStatus(
        eventId,
        conv.id,
        statusId,
        excuseTypeId
      );
      const convs = await convocationService.getConvocations(eventId);
      setConvocations(convs);
    } catch (e: any) {
      alert(e?.message ?? "Error al actualizar estado");
    }
  };

  const handleMoveToWaiting = async (convocationId: string) => {
    if (!canEdit) return alert("No se puede editar: el evento ya ha comenzado o está cerrado.");
    try {
      await convocationService.deleteConvocation(eventId, convocationId);
      const [conv, pl] = await Promise.all([
        convocationService.getConvocations(eventId),
        convocationService.getEventPlayers(eventId),
      ]);
      setConvocations(conv);
      setPlayers(pl);
    } catch (e: any) {
      alert(e?.message ?? "Error al mover a lista de espera");
    }
  };

  const [deconvokeDialog, setDeconvokeDialog] = useState<{
    open: boolean;
    conv?: ConvocationItem;
    waitingPlayerId?: string;
  }>({ open: false });

  const [notAvailableDialog, setNotAvailableDialog] = useState<{
    open: boolean;
    conv?: ConvocationItem;
  }>({ open: false });

  return (
    <div>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Convocatoria" />
        <Tab label="Asistencia" />
      </Tabs>

      {tab === 0 && (
        <Box className={styles.page}>
          <div className={styles.half}>
            <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderBlue}`}>
              <div className={styles.listGroupTitle}>
                <span>Lista de espera</span>
                <span className={styles.listGroupCount}>{notConvoked.length}</span>
              </div>
              {waitingList.length > 0 && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={async () => {
                      if (!coachAuthService.hasRole("Coach"))
                        return alert("Solo un entrenador puede convocar.");
                      if (!canEdit)
                        return alert(
                          "No se puede editar: el evento ya ha comenzado o está cerrado."
                        );
                      if (adding) return;
                      setAdding(true);
                      try {
                        await Promise.all(
                          waitingList
                            .filter((p) => p.id)
                            .map((p) =>
                              convocationService.addConvocation(eventId, p.id!)
                            )
                        );
                        const [conv, pl] = await Promise.all([
                          convocationService.getConvocations(eventId),
                          convocationService.getEventPlayers(eventId),
                        ]);
                        setConvocations(conv);
                        setPlayers(pl);
                      } catch (e: any) {
                        alert(e?.message ?? "Error al convocar");
                      } finally {
                        setAdding(false);
                      }
                    }}
                    disabled={adding || !coachAuthService.hasRole("Coach")}
                  >
                    Convocar toda la lista de espera
                  </Button>
                )}
            </div>

            <NotConvokedList
              players={waitingList}
              photos={playerPhotos}
              onAdd={handleAdd}
              onReject={(playerId) =>
                setDeconvokeDialog({ open: true, waitingPlayerId: playerId })
              }
              canEdit={coachAuthService.hasRole("Coach")}
              adding={adding}
            />
          </div>

          <div className={styles.half}>
            <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderTeal}`}>
              <div className={styles.listGroupTitle}>
                <span>Convocados</span>
                <span className={styles.listGroupCount}>{convocations.filter((c) => c.player).length}</span>
              </div>
            </div>

            {(() => {
              if (loading) return <div>Cargando...</div>;
              const filtered = convocations.filter((c) => c.player);

              const acceptedId = statuses.find((s) => s.name === "Accepted")?.id;
              const pendingId = statuses.find((s) => s.name === "Pending")?.id;
              const deconvokeId = statuses.find((s) => s.name === "Deconvoke")?.id;
              // Exclude injured players from accepted/pending — they always go to Desconvocados
              const accepted = filtered.filter((c) => c.status === acceptedId && !c.isInjured);
              const pending = filtered.filter((c) => c.status === pendingId && !c.isInjured);
              // Injured with a convocation record
              const injuredWithConv = filtered.filter((c) => c.isInjured);
              // Injured without a convocation record (already in the waiting list as injured)
              const injuredNoConv: PlayerSimple[] = injuredWaiting;
              // Desconvocados no lesionados (solo Deconvoke)
              const declinedNonInjured = filtered.filter(
                (c) => c.status === deconvokeId && !c.isInjured
              );
              const totalDesconvocados = injuredNoConv.length + injuredWithConv.length + declinedNonInjured.length;

              if (filtered.length === 0 && injuredNoConv.length === 0)
                return <EmptyState description="No hay convocados aún." />;

              const renderDeconvokedCard = (c: ConvocationItem) => (
                <ConvocationCard
                  key={c.id}
                  conv={c}
                  isInjured={c.isInjured}
                  photoSrc={
                    playerPhotos[String(c.player?.id ?? "")] ??
                    playerPhotos[String(c.player?.urlPhoto ?? "")] ??
                    defaultAvatar
                  }
                  statuses={statuses}
                  excuseTypes={excuseTypes}
                  canEdit={canEdit}
                  onChangeStatus={handleChangeStatus}
                  onDelete={(cv) => {
                    if (!canEdit) return alert("No se puede editar: el evento ya ha comenzado.");
                    setDeconvokeDialog({ open: true, conv: cv });
                  }}
                  onMoveToWaiting={(cv) => handleMoveToWaiting(cv.id)}
                />
              );

              const renderInjuredCard = (player: PlayerSimple) => {
                const p = player as any;
                const byId = p.id != null ? playerPhotos[String(p.id)] : null;
                const byUrl = p.urlPhoto ? playerPhotos[String(p.urlPhoto)] : null;
                const rawPhotoSrc = byId ?? byUrl ?? null;
                const photo = rawPhotoSrc ?? defaultAvatar;
                const displayName = p.alias || ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || "Jugador";
                const dorsalValue =
                  typeof p.dorsal === "number" ? p.dorsal : p.dorsal ? Number(p.dorsal) : null;
                const hasDorsal =
                  typeof dorsalValue === "number" && Number.isFinite(dorsalValue);
                return (
                  <div key={player.id} className={styles.cardWrap}>
                    <div className={styles.cromoCard}>
                      {p.id ? (
                        <Link to={`/coach/player/${p.id}`} className={styles.cromoPhotoLink}>
                          <div className={styles.cromoPhotoArea}>
                            <img src={photo} alt={displayName} className={photo === defaultAvatar ? styles.cromoPhotoAvatar : styles.cromoPhoto} />
                            <div className={styles.cromoGradient} />
                            {hasDorsal && <div className={styles.cromoDorsalBadge}>{dorsalValue}</div>}
                            <div className={styles.cromoInjuryCornerBadge}>🩹</div>
                            <div className={`${styles.cromoStatusStripe} ${styles.cromoStatusStripeDeclined}`} />
                          </div>
                        </Link>
                      ) : (
                        <div className={styles.cromoPhotoArea}>
                          <img src={photo} alt={displayName} className={photo === defaultAvatar ? styles.cromoPhotoAvatar : styles.cromoPhoto} />
                          <div className={styles.cromoGradient} />
                          {hasDorsal && <div className={styles.cromoDorsalBadge}>{dorsalValue}</div>}
                          <div className={styles.cromoInjuryCornerBadge}>🩹</div>
                          <div className={`${styles.cromoStatusStripe} ${styles.cromoStatusStripeDeclined}`} />
                        </div>
                      )}
                      <div className={styles.cromoBody}>
                        <div className={styles.cromoAccentLine} />
                        <div className={styles.cromoName}>{displayName}</div>
                        {p.position && <div className={styles.cromoPosition}>{p.position}</div>}
                        <div className={styles.cromoActions}>
                          <div className={styles.cromoInjuredBadge}>🩹 Lesionado</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              };

              const renderCard = (c: ConvocationItem) => (
                <ConvocationCard
                  key={c.id}
                  conv={c}
                  photoSrc={
                    playerPhotos[String(c.player?.id ?? "")] ??
                    playerPhotos[String(c.player?.urlPhoto ?? "")] ??
                    defaultAvatar
                  }
                  statuses={statuses}
                  excuseTypes={excuseTypes}
                  canEdit={canEdit}
                  onChangeStatus={handleChangeStatus}
                  onDelete={(cv) => {
                    if (!canEdit)
                      return alert(
                        "No se puede editar: el evento ya ha comenzado."
                      );
                    setDeconvokeDialog({ open: true, conv: cv });
                  }}
                  onMoveToWaiting={(cv) => handleMoveToWaiting(cv.id)}
                />
              );

              return (
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
                  {pending.length > 0 && (
                    <div>
                      <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderOrange}`}>
                        <div className={styles.listGroupTitle}>
                          <span>Pendientes de aceptar</span>
                          <span className={styles.listGroupCount}>{pending.length}</span>
                        </div>
                        {canEdit && (() => {
                            const acceptedId = statuses.find((s) => s.name === "Accepted")?.id;
                            if (!acceptedId) return null;
                            return (
                              <Button
                                size="small"
                                variant="outlined"
                                disabled={acceptingAll}
                                onClick={async () => {
                                  setAcceptingAll(true);
                                  try {
                                    await Promise.all(
                                      pending.map((c) =>
                                        convocationService.updateConvocationStatus(eventId, c.id, acceptedId, null)
                                      )
                                    );
                                    const conv = await convocationService.getConvocations(eventId);
                                    setConvocations(conv);
                                  } catch (err: any) {
                                    alert(err?.message ?? "Error al aceptar convocados");
                                  } finally {
                                    setAcceptingAll(false);
                                  }
                                }}
                              >
                                Aceptar todos
                              </Button>
                            );
                          })()}
                      </div>
                      <div className={styles.convocatedList}>{pending.map(renderCard)}</div>
                    </div>
                  )}
                  {accepted.length > 0 && (
                    <div>
                      <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderGreen}`}>
                        <div className={styles.listGroupTitle}>
                          <span>Aceptados</span>
                          <span className={styles.listGroupCount}>{accepted.length}</span>
                        </div>
                      </div>
                      <div className={styles.convocatedList}>{accepted.map(renderCard)}</div>
                    </div>
                  )}
                  {totalDesconvocados > 0 ? (
                    <div>
                      <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderRed}`}>
                        <div className={styles.listGroupTitle}>
                          <span>Desconvocados</span>
                          <span className={styles.listGroupCount}>{totalDesconvocados}</span>
                        </div>
                      </div>
                      <div className={styles.convocatedList}>
                        {injuredNoConv.map(renderInjuredCard)}
                        {injuredWithConv.map(renderDeconvokedCard)}
                        {declinedNonInjured.map(renderDeconvokedCard)}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </div>
        </Box>
      )}

      {tab === 1 && (
        <Box className={styles.page}>
          <div style={{ width: "100%" }}>
            <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderBlue}`} style={{ marginBottom: 8 }}>
              <span>Asistencia</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {canEdit && (() => {
                  const acceptedId = statuses.find((s) => s.name === "Accepted")?.id;
                  const notAttending = convocations.filter(
                    (c) => c.status === acceptedId && c.assistanceTypeId !== 1
                  );
                  if (notAttending.length === 0) return null;
                  return (
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={settingAllAttends}
                      onClick={async () => {
                        setSettingAllAttends(true);
                        try {
                          await Promise.all(
                            notAttending.map((c) =>
                              assistanceTypeService.updateConvocationAssistance(eventId, c.id, 1, null)
                            )
                          );
                          const conv = await convocationService.getConvocations(eventId);
                          setConvocations(conv);
                        } catch (err: any) {
                          alert(err?.message ?? "Error al actualizar asistencia");
                        } finally {
                          setSettingAllAttends(false);
                        }
                      }}
                    >
                      Todos asisten
                    </Button>
                  );
                })()}
              </div>
            </div>
            {(() => {
              const acceptedId = statuses.find((s) => s.name === "Accepted")?.id;
              const withAttendance = convocations.filter((c) => c.status === acceptedId);
              if (withAttendance.length === 0) {
                return <EmptyState title="Asistencia" description="No hay jugadores aceptados todavía." />;
              }
              // ids 1 (Asiste) y 4 (Llega tarde) = asisten; 2 y 3 = no asisten; null = sin indicar
              const attend = withAttendance.filter((c) => c.assistanceTypeId === 1 || c.assistanceTypeId === 4);
              const absent = withAttendance.filter((c) => c.assistanceTypeId === 2 || c.assistanceTypeId === 3);
              const pending = withAttendance.filter((c) => !c.assistanceTypeId);

              const renderCard = (c: typeof withAttendance[0]) => {
                const assistColorClass = (id: number | null | undefined) => {
                  if (id === 1) return styles.optionBtnGreen;
                  if (id === 2) return styles.optionBtnOrange;
                  if (id === 3) return styles.optionBtnRed;
                  if (id === 4) return styles.optionBtnBlue;
                  return styles.optionBtnGray;
                };
                const NO_EXCUSA_ID = 2;
                const p = c.player as any;
                const displayName = p?.alias || ((p?.name ?? "") + " " + (p?.lastName ?? "")).trim() || "Jugador";
                const dorsalValue =
                  typeof p?.dorsal === "number" ? p.dorsal : p?.dorsal ? Number(p.dorsal) : null;
                const hasDorsal =
                  typeof dorsalValue === "number" && Number.isFinite(dorsalValue);
                const rawPhotoSrc =
                  playerPhotos[String(c.player?.id ?? "")] ??
                  playerPhotos[String(c.player?.urlPhoto ?? "")] ??
                  null;
                const photo = rawPhotoSrc ?? defaultAvatar;
                const stripeClass =
                  c.assistanceTypeId === 1 || c.assistanceTypeId === 4
                    ? styles.cromoStatusStripeAttends
                    : c.assistanceTypeId === 2 || c.assistanceTypeId === 3
                    ? styles.cromoStatusStripeAbsent
                    : styles.cromoStatusStripePending;

                return (
                  <div key={c.id} className={styles.cardWrap}>
                    <div className={styles.cromoCard}>
                      {c.player?.id ? (
                        <Link to={`/coach/player/${c.player.id}`} className={styles.cromoPhotoLink}>
                          <div className={styles.cromoPhotoArea}>
                            <img src={photo} alt={displayName} className={photo === defaultAvatar ? styles.cromoPhotoAvatar : styles.cromoPhoto} />
                            <div className={styles.cromoGradient} />
                            {hasDorsal && <div className={styles.cromoDorsalBadge}>{dorsalValue}</div>}
                            <div className={`${styles.cromoStatusStripe} ${stripeClass}`} />
                          </div>
                        </Link>
                      ) : (
                        <div className={styles.cromoPhotoArea}>
                          <img src={photo} alt={displayName} className={photo === defaultAvatar ? styles.cromoPhotoAvatar : styles.cromoPhoto} />
                          <div className={styles.cromoGradient} />
                          {hasDorsal && <div className={styles.cromoDorsalBadge}>{dorsalValue}</div>}
                          <div className={`${styles.cromoStatusStripe} ${stripeClass}`} />
                        </div>
                      )}
                      <div className={styles.cromoBody}>
                        <div className={styles.cromoAccentLine} />
                        <div className={styles.cromoName}>{displayName}</div>
                        {p?.position && <div className={styles.cromoPosition}>{p.position}</div>}
                        <div className={styles.cromoActions}>
                          <div className={styles.optionGroup}>
                            <button
                              disabled={!canEdit}
                              className={`${styles.optionBtn} ${styles.optionBtnGray}${!c.assistanceTypeId ? " " + styles.optionBtnActive : ""}`}
                              onClick={async () => {
                                try {
                                  await assistanceTypeService.updateConvocationAssistance(eventId, c.id, null, null);
                                  const conv = await convocationService.getConvocations(eventId);
                                  setConvocations(conv);
                                } catch (err: any) { alert(err?.message ?? "Error"); }
                              }}
                            >Sin indicar</button>
                            {assistanceTypes.map((a) => (
                              <button
                                key={a.id}
                                disabled={!canEdit}
                                className={`${styles.optionBtn} ${assistColorClass(a.id)}${c.assistanceTypeId === a.id ? " " + styles.optionBtnActive : ""}`}
                                onClick={async () => {
                                  try {
                                    await assistanceTypeService.updateConvocationAssistance(eventId, c.id, a.id, null);
                                    const conv = await convocationService.getConvocations(eventId);
                                    setConvocations(conv);
                                  } catch (err: any) { alert(err?.message ?? "Error al actualizar asistencia"); }
                                }}
                              >{a.name}</button>
                            ))}
                          </div>
                          {c.assistanceTypeId === NO_EXCUSA_ID && excuseTypes.length > 0 && (
                            <div className={styles.optionGroupSub}>
                              {excuseTypes.map((ex) => (
                                <button
                                  key={ex.id}
                                  disabled={!canEdit}
                                  className={`${styles.optionBtn} ${styles.optionSubBtn} ${styles.optionBtnPurple}${c.excuseTypeId === ex.id ? " " + styles.optionBtnActive : ""}`}
                                  onClick={async () => {
                                    try {
                                      await assistanceTypeService.updateConvocationAssistance(eventId, c.id, NO_EXCUSA_ID, ex.id);
                                      const conv = await convocationService.getConvocations(eventId);
                                      setConvocations(conv);
                                    } catch (err: any) { alert(err?.message ?? "Error al guardar excusa"); }
                                  }}
                                >{ex.name}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              };

              return (
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
                  {attend.length > 0 && (
                    <div>
                      <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderGreen}`}>
                        <div className={styles.listGroupTitle}>
                          <span>Asisten</span>
                          <span className={styles.listGroupCount}>{attend.length}</span>
                        </div>
                      </div>
                      <div className={styles.convocatedList}>
                        {attend.map(renderCard)}
                      </div>
                    </div>
                  )}
                  {absent.length > 0 && (
                    <div>
                      <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderRed}`}>
                        <div className={styles.listGroupTitle}>
                          <span>No asisten</span>
                          <span className={styles.listGroupCount}>{absent.length}</span>
                        </div>
                      </div>
                      <div className={styles.convocatedList}>
                        {absent.map(renderCard)}
                      </div>
                    </div>
                  )}
                  {pending.length > 0 && (
                    <div>
                      <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderGray}`}>
                        <div className={styles.listGroupTitle}>
                          <span>Sin indicar</span>
                          <span className={styles.listGroupCount}>{pending.length}</span>
                        </div>
                      </div>
                      <div className={styles.convocatedList}>
                        {pending.map(renderCard)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </Box>
      )}

      <DeconvokeDialog
        open={deconvokeDialog.open}
        onClose={() => setDeconvokeDialog({ open: false })}
        excuseTypes={excuseTypes}
        hideTechnical={!isMatch && !!deconvokeDialog.waitingPlayerId}
        title={deconvokeDialog.waitingPlayerId ? "Motivo del rechazo" : undefined}
        onConfirm={async (reason) => {
          const excuseTypeId = reason === "technical" ? null : Number(reason);
          try {
            if (deconvokeDialog.waitingPlayerId) {
              // Player in lista de espera: add convocation then set Deconvoke
              const playerId = deconvokeDialog.waitingPlayerId;
              await convocationService.addConvocation(eventId, playerId);
              const reloaded = await convocationService.getConvocations(eventId);
              const newConv = reloaded.find((c) => c.player?.id === playerId);
              const deconvokeId = statuses.find((s) => s.name === "Deconvoke")?.id;
              if (newConv && deconvokeId) {
                await convocationService.updateConvocationStatus(eventId, newConv.id, deconvokeId, excuseTypeId);
              }
            } else if (deconvokeDialog.conv) {
              // Already-convoked player: set status to Deconvoke
              const deconvokeId = statuses.find((s) => s.name === "Deconvoke")?.id;
              if (deconvokeId) {
                await convocationService.updateConvocationStatus(
                  eventId,
                  deconvokeDialog.conv.id,
                  deconvokeId,
                  excuseTypeId
                );
              }
            }
            const [conv, pl] = await Promise.all([
              convocationService.getConvocations(eventId),
              convocationService.getEventPlayers(eventId),
            ]);
            setConvocations(conv);
            setPlayers(pl);
          } catch (e: any) {
            alert(e?.message ?? "Error al desconvocar");
          }
        }}
      />
    </div>
  );
}
