import React, { useReducer } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  Link,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
} from "@mui/material";
import styles from "./Register.module.css";
import { coachAuthService } from "../../../../apps/coach/services/authService";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { mapApiErrorToMessage, getErrorMessage } from "../../../utils/errorMessages";
import BaseLayout from "../../../components/ui/BaseLayout/BaseLayout";
import TrialConfirmDialog from "../../../components/TrialConfirmDialog";
import RoleSelector from "./components/RoleSelector";
import InvitationCodeField from "./components/InvitationCodeField";
import TeamPlayerPicker from "./components/TeamPlayerPicker";
import PendingClubApprovalNotice from "./components/PendingClubApprovalNotice";
import type { UserType } from "../../../constants/userTypes";
import type {
  RegisterPayingAccountPayload,
  RegisterPayingAccountResponse,
  PreviewClubCodeResponse,
  PreviewTeamCodeResponse,
} from "../../../types/scope";

type CodeValidationState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "valid"; club?: PreviewClubCodeResponse; team?: PreviewTeamCodeResponse }
  | { status: "invalid"; errorCode: string };

interface RegisterFormState {
  alias: string;
  email: string;
  password: string;
  role: UserType | "";
  trialAccepted: boolean;
  trialDialogOpen: boolean;
  coachHasClubCode: boolean | null;
  invitationCode: string;
  codeValidation: CodeValidationState;
  selectedTeamPlayerId: string | null;
  isSubmitting: boolean;
  formError: string;
  successMessage: string;
  registeredPendingApproval: boolean;
}

const initialState: RegisterFormState = {
  alias: "",
  email: "",
  password: "",
  role: "",
  trialAccepted: false,
  trialDialogOpen: false,
  coachHasClubCode: null,
  invitationCode: "",
  codeValidation: { status: "idle" },
  selectedTeamPlayerId: null,
  isSubmitting: false,
  formError: "",
  successMessage: "",
  registeredPendingApproval: false,
};

type Action =
  | { type: "SET_FIELD"; field: "alias" | "email" | "password"; value: string }
  | { type: "SET_ROLE"; role: UserType }
  | { type: "OPEN_TRIAL_DIALOG" }
  | { type: "CANCEL_TRIAL" }
  | { type: "ACCEPT_TRIAL" }
  | { type: "SET_COACH_HAS_CLUB_CODE"; value: boolean }
  | { type: "SET_INVITATION_CODE"; value: string }
  | { type: "SET_CODE_VALIDATION"; value: CodeValidationState }
  | { type: "SET_SELECTED_TEAM_PLAYER"; value: string }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_ERROR"; message: string }
  | { type: "SUBMIT_SUCCESS_ACTIVE" }
  | { type: "SUBMIT_SUCCESS_PENDING" };

function reducer(state: RegisterFormState, action: Action): RegisterFormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value, formError: "", successMessage: "" };
    case "SET_ROLE": {
      // Atomic reset of every role-specific field, per design.md § State Management.
      const needsTrialDialog =
        action.role === "ClubDirector" || action.role === "Coach";
      return {
        ...initialState,
        alias: state.alias,
        email: state.email,
        password: state.password,
        role: action.role,
        trialDialogOpen: action.role === "ClubDirector",
      };
    }
    case "OPEN_TRIAL_DIALOG":
      return { ...state, trialDialogOpen: true };
    case "CANCEL_TRIAL":
      // Cancel aborts the role choice itself, not just the dialog.
      return { ...initialState, alias: state.alias, email: state.email, password: state.password };
    case "ACCEPT_TRIAL":
      return { ...state, trialAccepted: true, trialDialogOpen: false };
    case "SET_COACH_HAS_CLUB_CODE":
      return {
        ...state,
        coachHasClubCode: action.value,
        trialDialogOpen: !action.value, // "no code" -> trial gate; "yes code" -> never opens
        trialAccepted: false,
        invitationCode: "",
        codeValidation: { status: "idle" },
      };
    case "SET_INVITATION_CODE":
      return { ...state, invitationCode: action.value, codeValidation: { status: "idle" } };
    case "SET_CODE_VALIDATION":
      return { ...state, codeValidation: action.value };
    case "SET_SELECTED_TEAM_PLAYER":
      return { ...state, selectedTeamPlayerId: action.value };
    case "SUBMIT_START":
      return { ...state, isSubmitting: true, formError: "" };
    case "SUBMIT_ERROR":
      return { ...state, isSubmitting: false, formError: action.message };
    case "SUBMIT_SUCCESS_ACTIVE":
      return { ...state, isSubmitting: false, successMessage: "Registro exitoso. Ahora puedes iniciar sesión." };
    case "SUBMIT_SUCCESS_PENDING":
      return { ...state, isSubmitting: false, registeredPendingApproval: true };
    default:
      return state;
  }
}

function isClubCodeRole(role: UserType | ""): boolean {
  return role === "ClubMember";
}

function isTeamCodeRole(role: UserType | ""): boolean {
  return role === "Player" || role === "FamilyMember";
}

function isClubDirector(role: UserType | ""): boolean {
  return role === "ClubDirector";
}

function isCoach(role: UserType | ""): boolean {
  return role === "Coach";
}

function isFan(role: UserType | ""): boolean {
  return role === "Fan";
}

const Register: React.FC = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const navigate = useNavigate();

  const canSubmit =
    !!state.alias.trim() && !!state.email.trim() && !!state.password.trim() && !!state.role &&
    (state.role === "Fan" ||
      (state.role === "ClubDirector" && state.trialAccepted) ||
      (state.role === "Coach" && state.coachHasClubCode === false && state.trialAccepted) ||
      (state.role === "Coach" && state.coachHasClubCode === true && state.codeValidation.status === "valid") ||
      (isClubCodeRole(state.role) && state.codeValidation.status === "valid") ||
      (isTeamCodeRole(state.role) && state.codeValidation.status === "valid" && !!state.selectedTeamPlayerId));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!canSubmit) return;

    dispatch({ type: "SUBMIT_START" });
    try {
      const payload: RegisterPayingAccountPayload = {
        alias: state.alias,
        email: state.email,
        password: state.password,
        accountType: state.role,
      };

      // Add optional fields based on role
      if ((isClubDirector(state.role) || (isCoach(state.role) && state.coachHasClubCode === false)) && state.trialAccepted) {
        payload.trialAccepted = true;
      }

      if ((isCoach(state.role) && state.coachHasClubCode) || isClubCodeRole(state.role)) {
        payload.clubInvitationCode = state.invitationCode;
      }

      if (isTeamCodeRole(state.role)) {
        payload.teamInvitationCode = state.invitationCode;
        payload.teamPlayerId = state.selectedTeamPlayerId || undefined;
      }

      const result: RegisterPayingAccountResponse =
        await coachAuthService.registerPayingAccount(payload);

      if (Array.isArray(result.roles) && result.roles.length > 0) {
        try {
          localStorage.setItem("coach_roles", JSON.stringify(result.roles));
        } catch {}
      }

      if (result.status === "PendingClubApproval") {
        dispatch({ type: "SUBMIT_SUCCESS_PENDING" });
      } else {
        dispatch({ type: "SUBMIT_SUCCESS_ACTIVE" });
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      }
    } catch (error: any) {
      const errorMessage = mapApiErrorToMessage(error);
      dispatch({ type: "SUBMIT_ERROR", message: errorMessage });
    }
  };

  return (
    <BaseLayout appTitle="Futbol Base" hideFooterMenu>
      <div className={styles.container}>
        <Paper className={styles.paper} elevation={3}>
          <div className={styles.title}>
            <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
              Registrarse
            </Typography>
          </div>
          {state.formError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {state.formError}
            </Alert>
          )}
          {state.registeredPendingApproval ? (
            <PendingClubApprovalNotice />
          ) : state.successMessage ? (
            <Alert severity="success" sx={{ mb: 3 }}>
              {state.successMessage}
            </Alert>
          ) : null}
          <form className={styles.form} noValidate onSubmit={handleSubmit}>
            <TextField
              label="Correo Electrónico"
              type="email"
              variant="outlined"
              fullWidth
              required
              autoFocus
              autoComplete="email"
              value={state.email}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "email", value: e.target.value })}
            />
            <TextField
              label="Nombre de Usuario"
              type="text"
              variant="outlined"
              fullWidth
              required
              autoComplete="username"
              value={state.alias}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "alias", value: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Contraseña"
              type="password"
              variant="outlined"
              fullWidth
              required
              autoComplete="new-password"
              value={state.password}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "password", value: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />

            <RoleSelector
              value={state.role}
              onChange={(role) => dispatch({ type: "SET_ROLE", role })}
            />

            {isClubDirector(state.role) && (
              <TrialConfirmDialog
                open={state.trialDialogOpen}
                isProcessing={state.isSubmitting}
                onClose={() => dispatch({ type: "CANCEL_TRIAL" })}
                onAccept={() => dispatch({ type: "ACCEPT_TRIAL" })}
              />
            )}

            {isCoach(state.role) && (
              <>
                <FormControl component="fieldset" sx={{ width: "100%" }}>
                  <FormLabel component="legend">¿Tienes código de invitación de club?</FormLabel>
                  <RadioGroup
                    name="coachHasClubCode"
                    value={state.coachHasClubCode === null ? "" : String(state.coachHasClubCode)}
                    onChange={(e) =>
                      dispatch({ type: "SET_COACH_HAS_CLUB_CODE", value: e.target.value === "true" })
                    }
                  >
                    <FormControlLabel value="true" control={<Radio />} label="Sí" />
                    <FormControlLabel value="false" control={<Radio />} label="No" />
                  </RadioGroup>
                </FormControl>

                {state.coachHasClubCode === false && (
                  <TrialConfirmDialog
                    open={state.trialDialogOpen}
                    isProcessing={state.isSubmitting}
                    onClose={() => dispatch({ type: "CANCEL_TRIAL" })}
                    onAccept={() => dispatch({ type: "ACCEPT_TRIAL" })}
                  />
                )}

                {state.coachHasClubCode === true && (
                  <InvitationCodeField
                    kind="club"
                    membershipKind="Coach"
                    onValid={(response) =>
                      dispatch({ type: "SET_CODE_VALIDATION", value: { status: "valid", club: response as any } })
                    }
                    onInvalid={() =>
                      dispatch({ type: "SET_CODE_VALIDATION", value: { status: "invalid", errorCode: "" } })
                    }
                  />
                )}
              </>
            )}

            {((isCoach(state.role) && state.coachHasClubCode === true) || isClubCodeRole(state.role)) && (
              <InvitationCodeField
                kind="club"
                membershipKind={isCoach(state.role) ? "Coach" : "ClubMember"}
                onValid={(response) =>
                  dispatch({ type: "SET_CODE_VALIDATION", value: { status: "valid", club: response as any } })
                }
                onInvalid={() =>
                  dispatch({ type: "SET_CODE_VALIDATION", value: { status: "invalid", errorCode: "" } })
                }
              />
            )}

            {(isTeamCodeRole(state.role)) && (
              <>
                <InvitationCodeField
                  kind="team"
                  membershipKind={state.role === "Player" ? "Player" : "FamilyPlayer"}
                  onValid={(response) =>
                    dispatch({ type: "SET_CODE_VALIDATION", value: { status: "valid", team: response as any } })
                  }
                  onInvalid={() =>
                    dispatch({ type: "SET_CODE_VALIDATION", value: { status: "invalid", errorCode: "" } })
                  }
                />
                {state.codeValidation.status === "valid" && state.codeValidation.team && (
                  <TeamPlayerPicker
                    players={state.codeValidation.team.players}
                    role={state.role}
                    selectedId={state.selectedTeamPlayerId}
                    onSelect={(teamPlayerId) =>
                      dispatch({ type: "SET_SELECTED_TEAM_PLAYER", value: teamPlayerId })
                    }
                  />
                )}
              </>
            )}

            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              className={styles.submitButton}
              disabled={!canSubmit || state.isSubmitting}
            >
              {state.isSubmitting ? "Registrando..." : "Registrarse"}
            </Button>
          </form>
          <div className={styles.options}>
            <Link component={RouterLink} to="/login" underline="hover">
              ¿Ya tienes cuenta? Inicia sesión
            </Link>
          </div>
        </Paper>
      </div>
    </BaseLayout>
  );
};

export default Register;
