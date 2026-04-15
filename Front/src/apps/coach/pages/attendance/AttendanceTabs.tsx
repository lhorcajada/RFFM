import React, { useEffect, useMemo, useState } from "react";
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
import availabilityTypeService, { AvailabilityType } from "../../services/availabilityTypeService";
import assistanceTypeService, { AssistanceType } from "../../services/assistanceTypeService";
import { coachAuthService } from "../../services/authService";
import styles from "./AttendanceTabs.module.css";
import defaultAvatar from "../../../../assets/avatar.svg";
import PlayerCard from "../../components/PlayerCard/PlayerCard";
import NotConvokedList from "./components/NotConvokedList";
import ConvocationCard from "./components/ConvocationCard";
import DeclineDialog from "./components/DeclineDialog";
import DeconvokeDialog from "./components/DeconvokeDialog";

type Props = { eventId: string; eventStart?: string | null };

function statusNameMap(id: number, statuses: { id: number; name: string }[]) {
  const s = statuses.find((x) => x.id === id);
  if (!s) return "-";
  const m: Record<string, string> = {
    Pending: "Pendiente",
    Accepted: "Aceptado",
    Declined: "Declinado",
  };
  return m[s.name] ?? s.name;
}

export default function AttendanceTabs({ eventId, eventStart }: Props) {
  const [tab, setTab] = useState(0);
  const [players, setPlayers] = useState<PlayerSimple[]>([]);
  const [convocations, setConvocations] = useState<ConvocationItem[]>([]);
  const [playerPhotos, setPlayerPhotos] = useState<
    Record<string, string | null>
  >({});
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<{ id: number; name: string }[]>([]);
  const [excuseTypes, setExcuseTypes] = useState<ExcuseType[]>([]);
  const [availabilityTypes, setAvailabilityTypes] = useState<AvailabilityType[]>([]);
  const [assistanceTypes, setAssistanceTypes] = useState<AssistanceType[]>([]);
  const [settingAllAvailable, setSettingAllAvailable] = useState(false);
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
        const [pl, conv, st, ex, av, at] = await Promise.all([
          convocationService.getEventPlayers(eventId),
          convocationService.getConvocations(eventId),
          convocationStatusService.getConvocationStatuses(),
          excuseTypeService.getExcuseTypes(),
          availabilityTypeService.getAvailabilityTypes(),
          assistanceTypeService.getAssistanceTypes(),
        ]);
        if (!mounted) return;
        setPlayers(pl);
        setConvocations(conv);
        setStatuses(st);
        setExcuseTypes(ex);
        setAvailabilityTypes(av);
        setAssistanceTypes(at);
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
  const waitingList = notConvoked.filter((p) => !p.isInjured);
  const injuredWaiting = notConvoked.filter((p) => p.isInjured);

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
      // Auto-mark as available when accepting a convocation
      const acceptedId = statuses.find((s) => s.name === "Accepted")?.id;
      if (statusId === acceptedId && conv.availabilityTypeId == null) {
        try {
          await availabilityTypeService.updateConvocationAvailability(eventId, conv.id, 1);
        } catch (_) { /* non-blocking */ }
      }
      const convs = await convocationService.getConvocations(eventId);
      setConvocations(convs);
    } catch (e: any) {
      alert(e?.message ?? "Error al actualizar estado");
    }
  };

  const [declineDialog, setDeclineDialog] = useState<{
    open: boolean;
    conv?: ConvocationItem;
  }>({ open: false });

  const [deconvokeDialog, setDeconvokeDialog] = useState<{
    open: boolean;
    conv?: ConvocationItem;
    waitingPlayerId?: string;
  }>({ open: false });

  return (
    <div>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Convocatoria" />
        <Tab label="Disponibilidad" />
        <Tab label="Asistencia" />
      </Tabs>

      {tab === 0 && (
        <Box className={styles.page}>
          <div className={styles.half}>
            <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderBlue}`}>
              <span>Lista de espera</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className={styles.listGroupCount}>{notConvoked.length}</span>
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
            </div>

            <NotConvokedList
              players={waitingList}
              photos={playerPhotos}
              onAdd={handleAdd}
              onDeconvoke={(playerId) =>
                setDeconvokeDialog({ open: true, waitingPlayerId: playerId })
              }
              canEdit={coachAuthService.hasRole("Coach")}
              adding={adding}
            />
          </div>

          <div className={styles.half}>
            <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderTeal}`}>
              <span>Convocados</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className={styles.listGroupCount}>{convocations.length}</span>
                {canEdit && (() => {
                  const pendingId = statuses.find((s) => s.name === "Pending")?.id;
                  const notAccepted = convocations.filter(
                    (c) => c.player && c.status === pendingId
                  );
                  if (notAccepted.length === 0) return null;
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
                            notAccepted.map((c) =>
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
            </div>

            {(() => {
              if (loading) return <div>Cargando...</div>;
              const filtered = convocations.filter((c) => c.player);

              const acceptedId = statuses.find((s) => s.name === "Accepted")?.id;
              const pendingId = statuses.find((s) => s.name === "Pending")?.id;
              const declinedId = statuses.find((s) => s.name === "Declined")?.id;
              const deconvokeId = statuses.find((s) => s.name === "Deconvoke")?.id;
              // Exclude injured players from accepted/pending — they always go to Desconvocados
              const accepted = filtered.filter((c) => c.status === acceptedId && !(c.isInjured || c.player.isInjured));
              const pending = filtered.filter((c) => c.status === pendingId && !(c.isInjured || c.player.isInjured));
              // All injured: not-convocated + any convocation where player is injured (regardless of status)
              const allInjured: PlayerSimple[] = [
                ...injuredWaiting,
                ...filtered
                  .filter((c) => c.isInjured || c.player.isInjured)
                  .map((c) => ({ ...c.player, isInjured: true })),
              ];
              // Desconvocados no lesionados
              const declinedNonInjured = filtered.filter(
                (c) =>
                  ((c.status === declinedId && (!c.excuseTypeId || excuseTypes.find(e => e.id === c.excuseTypeId)?.name !== "Decisión técnica"))
                  || (c.status === deconvokeId))
                  && !(c.isInjured || c.player.isInjured)
              );

              if (filtered.length === 0 && allInjured.length === 0)
                return <EmptyState description="No hay convocados aún." />;

              const renderInjuredCard = (p: PlayerSimple) => {
                const byId = p.id != null ? playerPhotos[String(p.id)] : null;
                const byUrl = p.urlPhoto ? playerPhotos[String(p.urlPhoto)] : null;
                const photoSrc = byId ?? byUrl ?? defaultAvatar;
                return (
                  <div key={p.id} className={styles.cardWrap}>
                    <div className={`${styles.cardInner} ${styles.cardStatusDeclined}`}>
                      <PlayerCard
                        player={{ ...(p as any), position: p.position }}
                        photoSrc={photoSrc}
                        actions={
                          <div className={styles.tagBadgeRow}>
                            <span className={`${styles.tagBadge} ${styles.tagInjured}`}>Lesionado</span>
                          </div>
                        }
                      />
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
                  onRequestDecline={(cv) =>
                    setDeclineDialog({ open: true, conv: cv })
                  }
                />
              );

              return (
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
                  {accepted.length > 0 && (
                    <div>
                      <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderGreen}`}>
                        <span>Aceptados</span>
                        <span className={styles.listGroupCount}>{accepted.length}</span>
                      </div>
                      <div className={styles.convocatedList}>{accepted.map(renderCard)}</div>
                    </div>
                  )}
                  {pending.length > 0 && (
                    <div>
                      <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderGray}`}>
                        <span>Pendientes</span>
                        <span className={styles.listGroupCount}>{pending.length}</span>
                      </div>
                      <div className={styles.convocatedList}>{pending.map(renderCard)}</div>
                    </div>
                  )}
                  {allInjured.length > 0 || declinedNonInjured.length > 0 ? (
                    <div>
                      <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderRed}`}>
                        <span>Desconvocados</span>
                        <span className={styles.listGroupCount}>{allInjured.length + declinedNonInjured.length}</span>
                      </div>
                      <div className={styles.convocatedList}>
                        {allInjured.map(renderInjuredCard)}
                        {declinedNonInjured.map(renderCard)}
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
              <span>Disponibilidad</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {canEdit && (() => {
                  const acceptedStatusId = statuses.find((s) => s.name === "Accepted")?.id;
                  const notYetAvailable = convocations.filter(
                    (c) => c.status === acceptedStatusId && c.availabilityTypeId !== 1
                  );
                  if (notYetAvailable.length === 0) return null;
                  return (
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={settingAllAvailable}
                      onClick={async () => {
                        setSettingAllAvailable(true);
                        try {
                          await Promise.all(
                            notYetAvailable.map((c) =>
                              availabilityTypeService.updateConvocationAvailability(eventId, c.id, 1)
                            )
                          );
                          const conv = await convocationService.getConvocations(eventId);
                          setConvocations(conv);
                        } catch (err: any) {
                          alert(err?.message ?? "Error al actualizar disponibilidad");
                        } finally {
                          setSettingAllAvailable(false);
                        }
                      }}
                    >
                      Todos disponibles
                    </Button>
                  );
                })()}
              </div>
            </div>
            {(() => {
              const acceptedStatusId = statuses.find((s) => s.name === "Accepted")?.id;
              const accepted = convocations.filter((c) => c.status === acceptedStatusId);
              if (accepted.length === 0) {
                return <EmptyState title="Disponibilidad" description="No hay jugadores aceptados todavía." />;
              }
              const availClass = (availabilityTypeId: number | null | undefined) =>
                availabilityTypeId === 1
                  ? styles.cardAvailable
                  : availabilityTypeId === 2
                  ? styles.cardNotAvailable
                  : styles.cardPending;

              const available = accepted.filter((c) => c.availabilityTypeId === 1);
              const notAvailable = accepted.filter((c) => c.availabilityTypeId === 2);
              const pending = accepted.filter((c) => !c.availabilityTypeId);

              const renderCard = (c: typeof accepted[0]) => {
                const availColorClass = (id: number | null | undefined) => {
                  if (id === 1) return styles.optionBtnGreen;
                  if (id === 2) return styles.optionBtnRed;
                  return styles.optionBtnGray;
                };
                const NOT_AVAILABLE_ID = 2;
                const availOptions = (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
                    <div className={styles.optionGroup}>
                      {availabilityTypes.map((a) => (
                        <button
                          key={a.id}
                          disabled={!canEdit}
                          className={`${styles.optionBtn} ${availColorClass(a.id)}${c.availabilityTypeId === a.id ? " " + styles.optionBtnActive : ""}`}
                          onClick={async () => {
                            try {
                              await availabilityTypeService.updateConvocationAvailability(eventId, c.id, a.id);
                              const conv = await convocationService.getConvocations(eventId);
                              setConvocations(conv);
                            } catch (err: any) { alert(err?.message ?? "Error al actualizar disponibilidad"); }
                          }}
                        >{a.name}</button>
                      ))}
                    </div>
                    {c.availabilityTypeId === NOT_AVAILABLE_ID && excuseTypes.length > 0 && (
                      <div className={styles.optionGroupSub}>
                        {excuseTypes.map((ex) => (
                          <button
                            key={ex.id}
                            disabled={!canEdit}
                            className={`${styles.optionBtn} ${styles.optionSubBtn} ${styles.optionBtnPurple}${c.excuseTypeId === ex.id ? " " + styles.optionBtnActive : ""}`}
                            onClick={async () => {
                              try {
                                await availabilityTypeService.updateConvocationAvailability(eventId, c.id, NOT_AVAILABLE_ID, ex.id);
                                const conv = await convocationService.getConvocations(eventId);
                                setConvocations(conv);
                              } catch (err: any) { alert(err?.message ?? "Error al guardar excusa"); }
                            }}
                          >{ex.name}</button>
                        ))}
                      </div>
                    )}
                  </div>
                );
                return (
                  <div key={c.id} className={styles.cardWrap}>
                    <div className={`${styles.cardInner} ${availClass(c.availabilityTypeId)}`}>
                      <PlayerCard
                        player={{ ...(c.player as any), position: c.player?.position }}
                        photoSrc={
                          playerPhotos[String(c.player?.id ?? "")] ??
                          playerPhotos[String(c.player?.urlPhoto ?? "")] ??
                          defaultAvatar
                        }
                        actions={availOptions}
                      />
                    </div>
                  </div>
                );
              };

              return (
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
                  {available.length > 0 && (
                    <div>
                      <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderGreen}`}>
                        <span>Disponibles</span>
                        <span className={styles.listGroupCount}>{available.length}</span>
                      </div>
                      <div className={styles.convocatedList}>
                        {available.map(renderCard)}
                      </div>
                    </div>
                  )}
                  {notAvailable.length > 0 && (
                    <div>
                      <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderRed}`}>
                        <span>No disponibles</span>
                        <span className={styles.listGroupCount}>{notAvailable.length}</span>
                      </div>
                      <div className={styles.convocatedList}>
                        {notAvailable.map(renderCard)}
                      </div>
                    </div>
                  )}
                  {pending.length > 0 && (
                    <div>
                      <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderGray}`}>
                        <span>Sin indicar</span>
                        <span className={styles.listGroupCount}>{pending.length}</span>
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

      {tab === 2 && (
        <Box className={styles.page}>
          <div style={{ width: "100%" }}>
            <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderBlue}`} style={{ marginBottom: 8 }}>
              <span>Asistencia</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {canEdit && (() => {
                  const notAttending = convocations.filter(
                    (c) => c.availabilityTypeId != null && c.assistanceTypeId !== 1
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
              const withAvailability = convocations.filter((c) => c.availabilityTypeId != null);
              if (withAvailability.length === 0) {
                return <EmptyState title="Asistencia" description="No hay jugadores con disponibilidad indicada todavía." />;
              }
              const assistanceClass = (assistanceTypeId: number | null | undefined) => {
                switch (assistanceTypeId) {
                  case 1: return styles.cardAssistanceAttends;
                  case 2: return styles.cardAssistanceExcused;
                  case 3: return styles.cardAssistanceUnexcused;
                  case 4: return styles.cardAssistanceLate;
                  default: return styles.cardAssistanceNone;
                }
              };
              const NO_EXCUSA_ID = 2;
              // ids 1 (Asiste) y 4 (Llega tarde) = asisten; 2 y 3 = no asisten; null = sin indicar
              const attend = withAvailability.filter((c) => c.assistanceTypeId === 1 || c.assistanceTypeId === 4);
              const absent = withAvailability.filter((c) => c.assistanceTypeId === 2 || c.assistanceTypeId === 3);
              const pending = withAvailability.filter((c) => !c.assistanceTypeId);

              const renderCard = (c: typeof withAvailability[0]) => {
                const assistColorClass = (id: number | null | undefined) => {
                  if (id === 1) return styles.optionBtnGreen;
                  if (id === 2) return styles.optionBtnOrange;
                  if (id === 3) return styles.optionBtnRed;
                  if (id === 4) return styles.optionBtnBlue;
                  return styles.optionBtnGray;
                };
                const assistOptions = (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
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
                );
                return (
                  <div key={c.id} className={styles.cardWrap}>
                    <div className={`${styles.cardInner} ${assistanceClass(c.assistanceTypeId)}`}>
                      <PlayerCard
                        player={{ ...(c.player as any), position: c.player?.position }}
                        photoSrc={
                          playerPhotos[String(c.player?.id ?? "")] ??
                          playerPhotos[String(c.player?.urlPhoto ?? "")] ??
                          defaultAvatar
                        }
                        actions={assistOptions}
                      />
                    </div>
                  </div>
                );
              };

              return (
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
                  {attend.length > 0 && (
                    <div>
                      <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderGreen}`}>
                        <span>Asisten</span>
                        <span className={styles.listGroupCount}>{attend.length}</span>
                      </div>
                      <div className={styles.convocatedList}>
                        {attend.map(renderCard)}
                      </div>
                    </div>
                  )}
                  {absent.length > 0 && (
                    <div>
                      <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderRed}`}>
                        <span>No asisten</span>
                        <span className={styles.listGroupCount}>{absent.length}</span>
                      </div>
                      <div className={styles.convocatedList}>
                        {absent.map(renderCard)}
                      </div>
                    </div>
                  )}
                  {pending.length > 0 && (
                    <div>
                      <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderGray}`}>
                        <span>Sin indicar</span>
                        <span className={styles.listGroupCount}>{pending.length}</span>
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

      <DeclineDialog
        open={declineDialog.open}
        onClose={() => setDeclineDialog({ open: false })}
        excuseTypes={excuseTypes}
        onAccept={async (excuseTypeId) => {
          if (!declineDialog.conv) return;
          const statusId = statuses.find((s) => s.name === "Declined")?.id;
          if (!statusId) return;
          await handleChangeStatus(
            declineDialog.conv,
            statusId,
            excuseTypeId ?? null
          );
          setDeclineDialog({ open: false });
        }}
      />
      <DeconvokeDialog
        open={deconvokeDialog.open}
        onClose={() => setDeconvokeDialog({ open: false })}
        excuseTypes={excuseTypes}
        onConfirm={async (reason) => {
          const excuseTypeId = reason === "technical" ? null : Number(reason);
          try {
            if (deconvokeDialog.waitingPlayerId) {
              // Player in lista de espera: add convocation then set Declined
              const playerId = deconvokeDialog.waitingPlayerId;
              await convocationService.addConvocation(eventId, playerId);
              const reloaded = await convocationService.getConvocations(eventId);
              const newConv = reloaded.find((c) => c.player?.id === playerId);
              const declinedId = statuses.find((s) => s.name === "Declined")?.id;
              if (newConv && declinedId) {
                await convocationService.updateConvocationStatus(eventId, newConv.id, declinedId, excuseTypeId);
              }
            } else if (deconvokeDialog.conv) {
              // Already-convoked player: set status to Declined (desconvocado)
              const declinedId = statuses.find((s) => s.name === "Declined")?.id;
              if (declinedId) {
                await convocationService.updateConvocationStatus(
                  eventId,
                  deconvokeDialog.conv.id,
                  declinedId,
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
