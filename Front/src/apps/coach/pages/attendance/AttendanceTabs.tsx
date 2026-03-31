import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, MenuItem, Select, Tabs, Tab, Typography } from "@mui/material";
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

  const canEdit = useMemo(() => {
    if (!eventStart) return true;
    const d = new Date(eventStart);
    return Date.now() < d.getTime();
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

  const handleAdd = async (playerId?: string) => {
    if (!coachAuthService.hasRole("Coach"))
      return alert("Solo un entrenador puede convocar.");
    if (!canEdit)
      return alert(
        "No se puede editar: el evento ya ha comenzado o está cerrado."
      );
    try {
      if (playerId) await convocationService.addConvocation(eventId, playerId);
      else await convocationService.addConvocationsBulk(eventId);
      const conv = await convocationService.getConvocations(eventId);
      setConvocations(conv);
    } catch (e: any) {
      alert(e?.message ?? "Error al convocar");
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

  const [declineDialog, setDeclineDialog] = useState<{
    open: boolean;
    conv?: ConvocationItem;
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
            <div className={styles.controls}>
              <Typography variant="subtitle1">No convocados</Typography>
              <div style={{ flex: 1 }} />
              {notConvoked.length > 0 && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleAdd(undefined)}
                  disabled={!coachAuthService.hasRole("Coach")}
                >
                  Convocar todo el equipo
                </Button>
              )}
            </div>

            <NotConvokedList
              players={notConvoked}
              photos={playerPhotos}
              onAdd={handleAdd}
              canEdit={coachAuthService.hasRole("Coach")}
            />
          </div>

          <div className={styles.half}>
            <div className={styles.controls}>
              <Typography variant="subtitle1">Convocados</Typography>
              <div style={{ flex: 1 }} />
            </div>

            {(() => {
              if (loading) return <div>Cargando...</div>;
              const filtered = convocations.filter((c) => c.player);
              if (filtered.length === 0)
                return <EmptyState description="No hay convocados aún." />;

              const acceptedId = statuses.find((s) => s.name === "Accepted")?.id;
              const pendingId = statuses.find((s) => s.name === "Pending")?.id;
              const declinedId = statuses.find((s) => s.name === "Declined")?.id;
              const accepted = filtered.filter((c) => c.status === acceptedId);
              const pending = filtered.filter((c) => c.status === pendingId);
              const declined = filtered.filter((c) => c.status === declinedId);

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
                  onDelete={async (cv) => {
                    if (!canEdit)
                      return alert(
                        "No se puede editar: el evento ya ha comenzado."
                      );
                    try {
                      await convocationService.deleteConvocation(
                        eventId,
                        cv.id
                      );
                      const convs = await convocationService.getConvocations(
                        eventId
                      );
                      setConvocations(convs);
                    } catch (e: any) {
                      alert(e?.message ?? "Error");
                    }
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
                      <Typography variant="subtitle2" style={{ marginBottom: 8, color: "#4caf50" }}>
                        Aceptados ({accepted.length})
                      </Typography>
                      <div className={styles.convocatedList}>{accepted.map(renderCard)}</div>
                    </div>
                  )}
                  {pending.length > 0 && (
                    <div>
                      <Typography variant="subtitle2" style={{ marginBottom: 8, color: "#9e9e9e" }}>
                        Pendientes ({pending.length})
                      </Typography>
                      <div className={styles.convocatedList}>{pending.map(renderCard)}</div>
                    </div>
                  )}
                  {declined.length > 0 && (
                    <div>
                      <Typography variant="subtitle2" style={{ marginBottom: 8, color: "#f44336" }}>
                        Declinados ({declined.length})
                      </Typography>
                      <div className={styles.convocatedList}>{declined.map(renderCard)}</div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </Box>
      )}

      {tab === 1 && (
        <Box className={styles.page}>
          <div style={{ width: "100%" }}>
            <div className={styles.controls} style={{ marginBottom: 8 }}>
              <Typography variant="subtitle1">Disponibilidad</Typography>
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

              const renderCard = (c: typeof accepted[0]) => (
                <div key={c.id} className={styles.cardWrap}>
                  <div className={`${styles.cardInner} ${availClass(c.availabilityTypeId)}`}>
                    <PlayerCard
                      player={{ ...(c.player as any), position: c.player?.position }}
                      photoSrc={
                        playerPhotos[String(c.player?.id ?? "")] ??
                        playerPhotos[String(c.player?.urlPhoto ?? "")] ??
                        defaultAvatar
                      }
                    />
                    <div className={styles.cardActions}>
                      <Select
                        size="small"
                        displayEmpty
                        value={c.availabilityTypeId ?? ""}
                        disabled={!canEdit}
                        onChange={async (e) => {
                          const val = e.target.value === "" ? null : Number(e.target.value);
                          try {
                            await availabilityTypeService.updateConvocationAvailability(eventId, c.id, val);
                            const conv = await convocationService.getConvocations(eventId);
                            setConvocations(conv);
                          } catch (err: any) {
                            alert(err?.message ?? "Error al actualizar disponibilidad");
                          }
                        }}
                      >
                        <MenuItem value="">Sin indicar</MenuItem>
                        {availabilityTypes.map((a) => (
                          <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
                        ))}
                      </Select>
                    </div>
                  </div>
                </div>
              );

              return (
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
                  {available.length > 0 && (
                    <div>
                      <Typography variant="subtitle2" style={{ marginBottom: 8, color: "#4caf50" }}>
                        Disponibles ({available.length})
                      </Typography>
                      <div className={styles.convocatedList}>
                        {available.map(renderCard)}
                      </div>
                    </div>
                  )}
                  {notAvailable.length > 0 && (
                    <div>
                      <Typography variant="subtitle2" style={{ marginBottom: 8, color: "#f44336" }}>
                        No disponibles ({notAvailable.length})
                      </Typography>
                      <div className={styles.convocatedList}>
                        {notAvailable.map(renderCard)}
                      </div>
                    </div>
                  )}
                  {pending.length > 0 && (
                    <div>
                      <Typography variant="subtitle2" style={{ marginBottom: 8, color: "#9e9e9e" }}>
                        Sin indicar ({pending.length})
                      </Typography>
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
            <div className={styles.controls} style={{ marginBottom: 8 }}>
              <Typography variant="subtitle1">Asistencia</Typography>
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

              const renderCard = (c: typeof withAvailability[0]) => (
                <div key={c.id} className={styles.cardWrap}>
                  <div className={`${styles.cardInner} ${assistanceClass(c.assistanceTypeId)}`}>
                    <PlayerCard
                      player={{ ...(c.player as any), position: c.player?.position }}
                      photoSrc={
                        playerPhotos[String(c.player?.id ?? "")] ??
                        playerPhotos[String(c.player?.urlPhoto ?? "")] ??
                        defaultAvatar
                      }
                    />
                    <div className={styles.cardActions}>
                      <Select
                        size="small"
                        displayEmpty
                        value={c.assistanceTypeId ?? ""}
                        disabled={!canEdit}
                        onChange={async (e) => {
                          const val = e.target.value === "" ? null : Number(e.target.value);
                          try {
                            await assistanceTypeService.updateConvocationAssistance(eventId, c.id, val, null);
                            const conv = await convocationService.getConvocations(eventId);
                            setConvocations(conv);
                          } catch (err: any) {
                            alert(err?.message ?? "Error al actualizar asistencia");
                          }
                        }}
                      >
                        <MenuItem value="">Sin indicar</MenuItem>
                        {assistanceTypes.map((a) => (
                          <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
                        ))}
                      </Select>
                      {c.assistanceTypeId === NO_EXCUSA_ID && (
                        <Select
                          size="small"
                          displayEmpty
                          value={c.excuseTypeId ?? ""}
                          disabled={!canEdit}
                          onChange={async (e) => {
                            if (e.target.value === "") return;
                            const val = Number(e.target.value);
                            try {
                              await assistanceTypeService.updateConvocationAssistance(eventId, c.id, NO_EXCUSA_ID, val);
                              const conv = await convocationService.getConvocations(eventId);
                              setConvocations(conv);
                            } catch (err: any) {
                              alert(err?.message ?? "Error al guardar excusa");
                            }
                          }}
                        >
                          <MenuItem value="">Seleccione excusa</MenuItem>
                          {excuseTypes.map((ex) => (
                            <MenuItem key={ex.id} value={ex.id}>
                              {ex.name}{ex.justified ? " (Just.)" : ""}
                            </MenuItem>
                          ))}
                        </Select>
                      )}
                    </div>
                  </div>
                </div>
              );

              return (
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
                  {attend.length > 0 && (
                    <div>
                      <Typography variant="subtitle2" style={{ marginBottom: 8, color: "#4caf50" }}>
                        Asisten ({attend.length})
                      </Typography>
                      <div className={styles.convocatedList}>
                        {attend.map(renderCard)}
                      </div>
                    </div>
                  )}
                  {absent.length > 0 && (
                    <div>
                      <Typography variant="subtitle2" style={{ marginBottom: 8, color: "#f44336" }}>
                        No asisten ({absent.length})
                      </Typography>
                      <div className={styles.convocatedList}>
                        {absent.map(renderCard)}
                      </div>
                    </div>
                  )}
                  {pending.length > 0 && (
                    <div>
                      <Typography variant="subtitle2" style={{ marginBottom: 8, color: "#9e9e9e" }}>
                        Sin indicar ({pending.length})
                      </Typography>
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
    </div>
  );
}
