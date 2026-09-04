import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import {
  getSportEventById,
  SportEventResponse,
} from "../../services/sportEventService";
import useTeamAndClub from "../../hooks/useTeamAndClub";
import sportEventTypeService from "../../services/sportEventTypeService";
import teamService from "../../services/teamService";
import clubService from "../../services/clubService";
import { Box, Button, CircularProgress, Chip } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { getEventTypeColor } from "./attendanceUtils";
import styles from "./AttendanceEvent.module.css";
import AttendanceTabs from "./AttendanceTabs";
import SportEventDialog from "./components/SportEventDialog";
import { coachAuthService } from "../../services/authService";
import { useConvocationManagement } from "../convocations/hooks/useConvocationManagement";
import ConvocationDetailsDialog from "../convocations/components/ConvocationDetailsDialog";
import { getTeamKits, type ClubKit } from "../../services/kitService";
import { toMatchState } from "../convocations/helpers/convocationUtils";

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
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<SportEventResponse | null>(null);
  const [eventTypeName, setEventTypeName] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [viewConvocationOpen, setViewConvocationOpen] = useState(false);
  const [kits, setKits] = useState<ClubKit[]>([]);
  const canEditEvent =
    coachAuthService.hasRole("Administrator") ||
    coachAuthService.hasRole("Coach") ||
    coachAuthService.hasRole("ClubDirector") ||
    coachAuthService.hasRole("ClubMember");

  const isMatchOrFriendly = /part|amist/i.test(eventTypeName ?? "");
  const matchState = event ? toMatchState(event) : null;

  // "Ver convocatoria" — read-only convocation data for this event's team/date, shared with
  // the Coach-only ConvocationMatchDetail screen via the same hook so the two never drift.
  const convocation = useConvocationManagement(event?.teamId ?? "", matchState?.date);
  const convocationConfirmed =
    convocation.mgmtCalled.length > 0 && convocation.mgmtPending.length === 0;

  // Deep link from elsewhere in the app (e.g. a news item linked to this match) — opens the
  // same popup the "Ver convocatoria" button opens, once the data it needs is ready.
  useEffect(() => {
    if (searchParams.get("viewConvocation") === "1" && isMatchOrFriendly && convocationConfirmed) {
      setViewConvocationOpen(true);
    }
  }, [searchParams, isMatchOrFriendly, convocationConfirmed]);

  useEffect(() => {
    const teamId = event?.teamId;
    if (!teamId) return;
    let mounted = true;
    getTeamKits(teamId)
      .then((data) => {
        if (mounted) setKits(data);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [event?.teamId]);

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
                onClick={() => {
                  const teamIdParam = encodeURIComponent(String(event?.teamId ?? ""));
                  navigate(
                    event?.teamId ? `/coach/attendance?teamId=${teamIdParam}` : "/coach/attendance"
                  );
                }}
                variant="outlined"
                size="small"
              >
                Volver
              </Button>
              {event && canEditEvent && (
                <Button
                  startIcon={<EditIcon />}
                  variant="outlined"
                  size="small"
                  onClick={() => setEditOpen(true)}
                >
                  Editar
                </Button>
              )}
              {event && isMatchOrFriendly && (
                <Button
                  startIcon={<SportsSoccerIcon />}
                  variant="contained"
                  size="small"
                  onClick={() => {
                    const teamIdParam = encodeURIComponent(String(event.teamId ?? ""));
                    const eventIdParam = encodeURIComponent(String(event.id));
                    navigate(
                      `/coach/convocations/match?teamId=${teamIdParam}&eventId=${eventIdParam}`,
                      { state: { match: toMatchState(event) } },
                    );
                  }}
                >
                  Ir al partido
                </Button>
              )}
              {event && isMatchOrFriendly && convocationConfirmed && (
                <Button
                  startIcon={<VisibilityIcon />}
                  variant="outlined"
                  size="small"
                  onClick={() => setViewConvocationOpen(true)}
                >
                  Ver convocatoria
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
                        // Date can come from eveDateTime (always present, even
                        // before RFFM publishes a kickoff time); the start time
                        // must come strictly from startTime, or it would show a
                        // fabricated time built from eveDateTime's placeholder.
                        const d = parseDate(
                          event.startTime ??
                            event.start ??
                            event.eveDateTime ??
                            undefined
                        );
                        const dTime = parseDate(event.startTime ?? undefined);
                        const start = dTime
                          ? dTime.toLocaleTimeString(undefined, {
                              timeStyle: "short",
                            })
                          : "-";
                        const date = d
                          ? d.toLocaleDateString(undefined, {
                              dateStyle: "long",
                            })
                          : "Por confirmar";
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
                    <div className={styles.value}>
                      {event.location ? (
                        event.locationMapUrl ? (
                          <a
                            className={styles.valueLink}
                            href={event.locationMapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {event.location}
                          </a>
                        ) : (
                          event.location
                        )
                      ) : (
                        "-"
                      )}
                    </div>
                  </div>

                  {isMatchOrFriendly && (
                    <div className={styles.infoRow}>
                      <div className={styles.label}>Rival</div>
                      <div className={styles.value}>
                        {event.rivalName ?? ""}
                      </div>
                    </div>
                  )}

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
                    isTraining={eventTypeName?.toLowerCase().includes("entrenamiento") ?? false}
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
      {event?.teamId && canEditEvent && (
        <SportEventDialog
          open={editOpen}
          teamId={event.teamId}
          event={event}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            setEditOpen(false);
            if (updated) setEvent(updated);
          }}
        />
      )}
      {event && isMatchOrFriendly && (
        <ConvocationDetailsDialog
          open={viewConvocationOpen}
          onClose={() => setViewConvocationOpen(false)}
          match={matchState}
          calledIds={convocation.mgmtCalled}
          notCalledIds={convocation.mgmtNotCalled}
          players={convocation.players}
          photos={convocation.mgmtPhotos}
          excuseMap={convocation.mgmtExcuseMap}
          excuseTypes={convocation.excuseTypes}
          kits={kits}
          selectedKitNumber={matchState?.selectedKitNumber ?? null}
          teamId={event?.teamId ?? ""}
          canCopyToWhatsApp={coachAuthService.hasRole("Coach")}
        />
      )}
    </BaseLayout>
  );
}
