import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Tabs, Tab, Typography } from "@mui/material";
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
import { coachAuthService } from "../../services/authService";
import styles from "./AttendanceTabs.module.css";
import defaultAvatar from "../../../../assets/avatar.svg";
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
        const [pl, conv, st, ex] = await Promise.all([
          convocationService.getEventPlayers(eventId),
          convocationService.getConvocations(eventId),
          convocationStatusService.getConvocationStatuses(),
          excuseTypeService.getExcuseTypes(),
        ]);
        if (!mounted) return;
        setPlayers(pl);
        setConvocations(conv);
        setStatuses(st);
        setExcuseTypes(ex);
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
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleAdd(undefined)}
                disabled={!coachAuthService.hasRole("Coach")}
              >
                Convocar todo el equipo
              </Button>
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

            <div className={styles.convocatedList}>
              {loading && <div>Cargando...</div>}
              {!loading && convocations.length === 0 && (
                <EmptyState description={"No hay convocados aún."} />
              )}
              {convocations
                .filter((c) => c.player)
                .map((c) => (
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
                ))}
            </div>
          </div>
        </Box>
      )}

      {tab === 1 && (
        <Box style={{ padding: 16 }}>
          <EmptyState
            title={"Disponibilidad"}
            description={"No hay datos de disponibilidad todavía."}
          />
        </Box>
      )}

      {tab === 2 && (
        <Box style={{ padding: 16 }}>
          <EmptyState
            title={"Asistencia"}
            description={"No hay datos de asistencia todavía."}
          />
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
