import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Typography,
  Card,
  CardActionArea,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
} from "@mui/material";
import SportsIcon from "@mui/icons-material/Sports";
import GroupsIcon from "@mui/icons-material/Groups";
import styles from "./AppSelector.module.css";
// Avatar is provided by AppHeader inside BaseLayout; no local import needed
import BaseLayout from "../../shared/components/ui/BaseLayout/BaseLayout";
import { coachAuthService } from "../../apps/coach/services/authService";
import {
  acquireCoachTrial,
  getMyRoles,
} from "../../apps/coach/services/coachApi";
import ContentLayout from "../../shared/components/ui/ContentLayout/ContentLayout";
import useTempToken from "../../apps/coach/hooks/useTempToken";
import { useUser } from "../../shared/context/UserContext";

function dispatchSnackbar(message: string) {
  try {
    window.dispatchEvent(
      new CustomEvent("rffm.show_snackbar", {
        detail: { message, severity: "warning" },
      })
    );
  } catch (e) {}
}

export default function AppSelector() {
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const { generateTempToken } = useTempToken();
  const { user } = useUser();
  // user avatar handled by AppHeader in BaseLayout
  return (
    <BaseLayout appTitle="Futbol Base" hideFooterMenu>
      <div className={styles.wrapper}>
        <div className={styles.container}>
          <ContentLayout
            title="Selecciona tu aplicación"
            headerClassName={styles.headerEdgeToEdge}
          >
            <div className={styles.gridContainer}>
              <Card className={styles.card}>
                <CardActionArea
                  onClick={() => {
                    // Federation requires Federation role (Administrator bypasses)
                    if (!coachAuthService.isAuthenticated()) {
                      navigate("/login");
                      return;
                    }
                    if (
                      coachAuthService.hasRole("Administrator") ||
                      coachAuthService.hasRole("Federation")
                    ) {
                      navigate("/federation/dashboard");
                    } else {
                      dispatchSnackbar(
                        "No tienes permisos para acceder a Federación."
                      );
                    }
                  }}
                  sx={{ height: "100%" }}
                >
                  <CardContent className={styles.cardContent}>
                    <GroupsIcon className={styles.icon} />
                    <Typography
                      variant="h4"
                      component="h2"
                      className={styles.cardTitle}
                    >
                      Federación
                    </Typography>
                    <Typography className={styles.cardDescription}>
                      Gestión de competiciones, equipos, clasificaciones y
                      estadísticas de la Federación de Fútbol de Madrid
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>

              <Card className={styles.card}>
                <CardActionArea
                  onClick={async () => {
                    // Coach requires Coach role (Administrator bypasses)
                    if (!coachAuthService.isAuthenticated()) {
                      navigate("/login");
                      return;
                    }
                    if (
                      coachAuthService.hasRole("Administrator") ||
                      coachAuthService.hasRole("Coach")
                    ) {
                      navigate("/coach/dashboard");
                      return;
                    }

                    // If we get here, user doesn't have the Coach role -> show trial dialog
                    setConfirmOpen(true);
                  }}
                  sx={{ height: "100%" }}
                >
                  <CardContent className={styles.cardContent}>
                    <SportsIcon className={styles.icon} />
                    <Typography
                      variant="h4"
                      component="h2"
                      className={styles.cardTitle}
                    >
                      Entrenadores
                    </Typography>
                    <Typography className={styles.cardDescription}>
                      Herramientas para entrenadores: gestión de plantillas,
                      entrenamientos, planificación y análisis de rendimiento
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
              <Dialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                aria-labelledby="coach-trial-dialog"
              >
                <DialogTitle id="coach-trial-dialog">
                  ¿Quieres activar la licencia gratuita de Entrenador?
                </DialogTitle>
                <DialogContent>
                  Al aceptar obtendrás 7 días gratuitos. Tras ese periodo se
                  cobrará según los datos de facturación que proporciones (se
                  abrirá el formulario más adelante).
                </DialogContent>
                <DialogActions>
                  <Button
                    onClick={() => setConfirmOpen(false)}
                    disabled={isProcessing}
                    variant="outlined"
                    color="primary"
                    sx={{
                      // keep readable contrast when disabled
                      "&.Mui-disabled": {
                        color: (theme) => theme.palette.text.primary,
                        borderColor: (theme) =>
                          theme.palette.action.disabledBackground,
                        opacity: 1,
                      },
                    }}
                    aria-label="Cancelar"
                  >
                    {isProcessing ? <CircularProgress size={18} /> : "Cancelar"}
                  </Button>
                  <Button
                    onClick={async () => {
                      try {
                        setIsProcessing(true);

                        // generate a temp token including user id when possible
                        let tempToken: string | undefined = undefined;
                        try {
                          const payload: any = {};
                          if (user?.id) payload.sub = user.id;
                          if (user?.email) payload.email = user.email;
                          tempToken = await generateTempToken(payload);
                        } catch (e) {
                          // ignore temp token errors
                        }

                        const result = await acquireCoachTrial(tempToken);

                        // if backend returned roles, cache them
                        if ((result as any)?.roles) {
                          try {
                            localStorage.setItem(
                              "coach_roles",
                              JSON.stringify((result as any).roles)
                            );
                          } catch (e) {}
                        }

                        // If backend returned a token, store it so coachAuthService can use it
                        if ((result as any)?.token) {
                          const tokenStr = (result as any).token;
                          try {
                            localStorage.setItem("coachAuthToken", tokenStr);
                            // extract userId from token
                            const decoded = JSON.parse(
                              atob(tokenStr.split(".")[1])
                            );
                            const extractedUserId =
                              decoded[
                                "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
                              ] || decoded.sub;
                            if (extractedUserId) {
                              localStorage.setItem(
                                "coachUserId",
                                extractedUserId
                              );
                            }
                            try {
                              const evtDetail: any = { token: tokenStr };
                              // include roles returned by backend if any
                              if ((result as any)?.roles) {
                                evtDetail.roles = (result as any).roles;
                              } else {
                                const storedRoles =
                                  localStorage.getItem("coach_roles");
                                if (storedRoles)
                                  evtDetail.roles = JSON.parse(storedRoles);
                              }
                              // Log with console.log so it's visible even when 'debug' level is filtered out
                              console.log(
                                "AppSelector: dispatching rffm.coach_token_updated",
                                evtDetail
                              );
                              // Keep debug-level log for developers who inspect verbose output
                              console.debug(
                                "AppSelector: dispatching rffm.coach_token_updated",
                                evtDetail
                              );
                              window.dispatchEvent(
                                new CustomEvent("rffm.coach_token_updated", {
                                  detail: evtDetail,
                                })
                              );
                              // Give listeners a short moment to pick up the event
                              await new Promise((r) => setTimeout(r, 120));
                            } catch (e) {}
                          } catch (e) {
                            // ignore store errors
                          }
                        } else {
                          // No token returned: confirm roles from backend and dispatch event
                          try {
                            console.log(
                              "AppSelector: no token from acquireCoachTrial, calling getMyRoles to confirm server-side roles"
                            );
                            const freshRoles = await getMyRoles();
                            console.log(
                              "AppSelector: getMyRoles result",
                              freshRoles
                            );
                            if (
                              Array.isArray(freshRoles) &&
                              freshRoles.length > 0
                            ) {
                              try {
                                localStorage.setItem(
                                  "coach_roles",
                                  JSON.stringify(freshRoles)
                                );
                              } catch (e) {}
                              try {
                                const evtDetail: any = { roles: freshRoles };
                                console.log(
                                  "AppSelector: dispatching rffm.coach_token_updated (roles only)",
                                  evtDetail
                                );
                                window.dispatchEvent(
                                  new CustomEvent("rffm.coach_token_updated", {
                                    detail: evtDetail,
                                  })
                                );
                                await new Promise((r) => setTimeout(r, 120));
                              } catch (e) {}
                            }
                          } catch (e) {
                            console.warn("AppSelector: getMyRoles failed", e);
                          }
                        }

                        // Wait briefly for auth state to refresh (avoid race with guards)
                        const waitForCoachRole = async (timeout = 1000) => {
                          const start = Date.now();
                          while (Date.now() - start < timeout) {
                            try {
                              const has = coachAuthService.hasRole("Coach");
                              const rolesNow = coachAuthService.getRoles();
                              console.log(
                                "AppSelector: wait loop rolesNow:",
                                rolesNow,
                                "hasCoach:",
                                has
                              );
                              if (has) return true;
                            } catch (e) {}
                            // small delay
                            await new Promise((r) => setTimeout(r, 50));
                          }
                          return false;
                        };

                        const ok = await waitForCoachRole(3000);
                        if (ok) {
                          console.log(
                            "AppSelector: role detected, navigating to coach dashboard"
                          );
                          navigate("/coach/dashboard");
                        } else {
                          console.warn(
                            "AppSelector: role NOT detected after wait, will attempt navigation but user may be redirected back"
                          );
                          navigate("/coach/dashboard");
                        }
                        try {
                          window.dispatchEvent(
                            new CustomEvent("rffm.show_snackbar", {
                              detail: {
                                message: "Licencia activada. ¡Disfruta 7 días!",
                                severity: "success",
                              },
                            })
                          );
                        } catch (e) {}
                      } catch (e: any) {
                        try {
                          window.dispatchEvent(
                            new CustomEvent("rffm.show_snackbar", {
                              detail: {
                                message:
                                  e?.response?.data?.message ??
                                  "Error activando la licencia.",
                                severity: "error",
                              },
                            })
                          );
                        } catch (er) {}
                      } finally {
                        setIsProcessing(false);
                        setConfirmOpen(false);
                      }
                    }}
                    disabled={isProcessing}
                    variant="contained"
                    color="primary"
                    aria-label="Aceptar 7 días"
                    sx={{
                      // Ensure contrast stays when disabled
                      "&.Mui-disabled": {
                        backgroundColor: (theme) => theme.palette.primary.main,
                        color: (theme) => theme.palette.primary.contrastText,
                        opacity: 0.9,
                      },
                      minWidth: 140,
                    }}
                  >
                    {isProcessing ? (
                      <>
                        <CircularProgress
                          size={18}
                          color="inherit"
                          sx={{ mr: 1 }}
                        />
                        Aceptando...
                      </>
                    ) : (
                      "Aceptar 7 días"
                    )}
                  </Button>
                </DialogActions>
              </Dialog>
            </div>
          </ContentLayout>
        </div>
      </div>
    </BaseLayout>
  );
}
