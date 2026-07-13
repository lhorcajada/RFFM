import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import {
  getSportEventById,
  SportEventResponse,
} from "../../services/sportEventService";
import useTeamAndClub from "../../hooks/useTeamAndClub";
import useTeamDashboardBack from "../../hooks/useTeamDashboardBack";
import sportEventTypeService from "../../services/sportEventTypeService";
import teamService from "../../services/teamService";
import clubService from "../../services/clubService";
import { Box, Button, CircularProgress, Chip } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import { getEventTypeColor } from "./attendanceUtils";
import styles from "./AttendanceEvent.module.css";
import AttendanceTabs from "./AttendanceTabs";
import type { MatchState } from "../convocations/components/convocationMatchDetail.types";

function toMatchState(ev: SportEventResponse): MatchState {
  const raw = ev.eveDateTime ?? ev.startTime ?? ev.start ?? null;
  const date = raw ? raw.trim().substring(0, 10) : "";
  let time = "";
  if (raw && raw.includes("T")) {
    const part = raw.split("T")[1]?.substring(0, 5) ?? "";
    if (part !== "00:00") time = part;
  }
  const isHomeMatch = ev.isHomeMatch !== false;
  const rivalName = ev.rivalName ?? ev.rival ?? "";
  const rivalShield = ev.rivalPhotoUrl ?? "";
  const myTeamName = ev.teamName ?? "";
  const myTeamShield = ev.teamPhotoUrl ?? "";
  return {
    date,
    time,
    localTeamName: isHomeMatch ? myTeamName : rivalName,
    localTeamShield: isHomeMatch ? myTeamShield : rivalShield,
    visitorTeamName: isHomeMatch ? rivalName : myTeamName,
    visitorTeamShield: isHomeMatch ? rivalShield : myTeamShield,
    isFinished: raw ? new Date(raw) < new Date() : false,
    isHomeTeam: isHomeMatch,
    field: ev.location ?? "",
    codacta: ev.codActa ?? null,
    selectedKitNumber: ev.selectedKitNumber ?? null,
  };
}

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
  const goToTeamDashboard = useTeamDashboardBack();

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
        if (!imgSrc && t.club?.id) {
          try {
            const emblem = await clubService.getClubEmblem(t.club.id);
            if (emblem?.data) {
              const blob = new Blob([emblem.data], {
                type: emblem.contentType ?? "image/png",
              });
              imgSrc = URL.createObjectURL(blob);
            }
          } catch (e) {
            // ignore
          }
        }
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
                onClick={() => goToTeamDashboard()}
                variant="outlined"
                size="small"
              >
                Volver
              </Button>
              {event && /part|amist/i.test(eventTypeName ?? "") && (
                <Button
                  startIcon={<SportsSoccerIcon />}
                  variant="contained"
                  size="small"
                  onClick={() => {
                    const teamIdParam = encodeURIComponent(String(event.teamId ?? ""));
                    navigate(`/coach/convocations/match?teamId=${teamIdParam}`, { state: { match: toMatchState(event) } });
                  }}
                >
                  Ir al partido
                </Button>
              )}
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
                          {event.rivalName ?? ""}
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

              {/* Aquí se muestra la UI de convocatoria / disponibilidad / asistencia */}
              {event && (
                // @ts-ignore - event may have different field names for start
                <React.Suspense fallback={<div>Cargando...</div>}>
                  {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                  {/* @ts-ignore */}
                  <AttendanceTabs
                    eventId={String(event.id ?? id)}
                    eventStart={
                      event.startTime ?? event.start ?? event.eveDateTime
                    }
                    isMatch={eventTypeName?.toLowerCase().includes("partido") ?? false}
                  />
                </React.Suspense>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12, padding: "24px 0" }}>
              <div>El evento no existe o fue eliminado.</div>
              <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} size="small">
                Volver al listado
              </Button>
            </div>
          )}
        </Box>
      </ContentLayout>
    </BaseLayout>
  );
}
