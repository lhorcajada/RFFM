import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import {
  getSportEventById,
  SportEventResponse,
} from "../../services/sportEventService";
import useTeamAndClub from "../../hooks/useTeamAndClub";
import sportEventTypeService from "../../services/sportEventTypeService";
import teamService from "../../services/teamService";
import { Box, Button, CircularProgress, Chip } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { getEventTypeColor } from "./attendanceUtils";
import styles from "./AttendanceEvent.module.css";

function parseDate(input?: string | null): Date | null {
  if (!input) return null;
  try {
    // handle /Date(123)/ and numeric timestamps
    const s = String(input).trim();
    const msMatch = s.match(/\/Date\((-?\d+)\)\//);
    if (msMatch) return new Date(Number(msMatch[1]));
    if (/^-?\d+$/.test(s)) return new Date(Number(s));
    // date-only
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + "T00:00:00");
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
    return null;
  } catch {
    return null;
  }
}

export default function AttendanceEvent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<SportEventResponse | null>(null);
  const [eventTypeName, setEventTypeName] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!id) return;
      const e = await getSportEventById(id);
      if (!mounted) return;
      setEvent(e);
      // resolve event type name
      try {
        if (e) {
          if (e.eventType) {
            setEventTypeName(e.eventType);
          } else if (e.eventTypeId) {
            const types = await sportEventTypeService.getSportEventTypes();
            if (!mounted) return;
            const found = types.find((t) => t.id === e.eventTypeId);
            setEventTypeName(found ? found.name : null);
          } else {
            setEventTypeName(null);
          }
        }
      } catch (err) {
        // ignore
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const { teamTitleNode } = useTeamAndClub();

  const [localTeamTitle, setLocalTeamTitle] = useState<React.ReactNode | null>(
    null
  );

  function getChipClass(name?: string | null) {
    if (!name) return `${styles.chip} ${styles.chipDefault}`;
    const key = name.replace(/\s|\//g, "").replace(/[^a-zA-Z0-9]/g, "");
    const map: Record<string, string> = {
      Partidos: styles.chipPartidos,
      Entrenamiento: styles.chipEntrenamiento,
      TorneoCompetición: styles.chipTorneoCompeticion,
      TorneoCompeticion: styles.chipTorneoCompeticion,
      Otro: styles.chipOtro,
    } as any;
    return `${styles.chip} ${
      map[name as keyof typeof map] ?? styles.chipDefault
    }`;
  }

  const titleNode = (
    <div className={styles.titleWrapper}>{teamTitleNode ?? localTeamTitle}</div>
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (teamTitleNode || !event?.teamId) return;
      try {
        const t = await teamService.getTeamById(event.teamId!);
        if (!mounted) return;
        if (!t) return;
        let imgSrc: string | null = null;
        if (t.urlPhoto) {
          const obj = await teamService.fetchTeamPhoto(t.urlPhoto);
          if (obj) imgSrc = obj;
        }
        if (!imgSrc && t.club?.shieldUrl) imgSrc = t.club.shieldUrl ?? null;
        const node = (
          <div className={styles.teamNode}>
            <img
              src={imgSrc ?? "/assets/logo.png"}
              alt={t.name}
              className={styles.teamImg}
            />
            <span>{t.name}</span>
          </div>
        );
        setLocalTeamTitle(node);
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [teamTitleNode, event?.teamId]);

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={<div>Gestionar asistencias</div>}
        subtitle={titleNode}
        actionBar={
          <div className={styles.actionBarContainer}>
            <div className={styles.actionLeft} />
            <div className={styles.actionRight}>
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate(-1)}
                variant="outlined"
                size="small"
              >
                Volver
              </Button>
            </div>
          </div>
        }
      >
        <Box className={styles.box}>
          {loading ? (
            <CircularProgress />
          ) : event ? (
            <div className={styles.container}>
              <div className={styles.infoContainer}>
                <div className={styles.infoTitle}>
                  <div>Información del evento</div>
                  <div className={getChipClass(eventTypeName)}>
                    {eventTypeName ?? ""}
                  </div>
                </div>
                <div className={styles.infoGrid}>
                  <div className={styles.infoRow}>
                    <div className={styles.label}>Nombre</div>
                    <div className={styles.value}>
                      {event.name ?? event.title}
                    </div>
                  </div>

                  <div className={styles.infoRow}>
                    <div className={styles.label}>Tipo</div>
                    <div className={styles.value}>{eventTypeName ?? "-"}</div>
                  </div>

                  <div className={styles.infoRow}>
                    <div className={styles.label}>Fecha / Horas</div>
                    <div className={styles.value}>
                      {(() => {
                        const d = parseDate(
                          event.startTime ??
                            event.start ??
                            event.eveDateTime ??
                            undefined
                        );
                        const start = d
                          ? d.toLocaleTimeString(undefined, {
                              timeStyle: "short",
                            })
                          : "-";
                        const date = d
                          ? d.toLocaleDateString(undefined, {
                              dateStyle: "long",
                            })
                          : "-";
                        const eEnd = parseDate(
                          event.end ?? event.endTime ?? undefined
                        );
                        const end = eEnd
                          ? eEnd.toLocaleTimeString(undefined, {
                              timeStyle: "short",
                            })
                          : "-";
                        const arr = parseDate(
                          event.arrivalDate ?? event.arrival ?? undefined
                        );
                        const arrival = arr
                          ? arr.toLocaleTimeString(undefined, {
                              timeStyle: "short",
                            })
                          : "-";
                        return (
                          <>
                            <strong>{date}</strong>
                            <span style={{ marginLeft: 8 }}>
                              {`Inicio ${start} • Fin ${end} • Llegada ${arrival}`}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div className={styles.infoRow}>
                    <div className={styles.label}>Lugar</div>
                    <div className={styles.value}>{event.location ?? "-"}</div>
                  </div>

                  {(() => {
                    const name = eventTypeName ?? "";
                    const isMatchOrFriendly = /part|amist/i.test(name);
                    if (!isMatchOrFriendly) return null;
                    return (
                      <div className={styles.infoRow}>
                        <div className={styles.label}>Rival</div>
                        <div className={styles.value}>
                          {event.rivalId ?? event.rival ?? "-"}
                        </div>
                      </div>
                    );
                  })()}

                  {event.description ? (
                    <div className={`${styles.infoRow} ${styles.fullWidth}`}>
                      <div className={styles.label}>Descripción</div>
                      <div className={`${styles.value} ${styles.description}`}>
                        {event.description}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Aquí iría el componente que lista jugadores y permite marcar asistencias */}
            </div>
          ) : (
            <div>Evento no encontrado</div>
          )}
        </Box>
      </ContentLayout>
    </BaseLayout>
  );
}
