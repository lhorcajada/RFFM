import React, { useReducer, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { coachColors } from '../theme/colors';
import { registerAccount } from '../api/register';
import { previewClubCode, previewTeamCode } from '../api/invitations';
import { getRegisterErrorMessage } from '../utils/registerErrorMessages';

type NavigationProp = NativeStackNavigationProp<any>;

type UserRole = 'Fan' | 'ClubDirector' | 'Coach' | 'ClubMember' | 'Player' | 'FamilyMember';

interface CodeValidationState {
  status: 'idle' | 'checking' | 'valid' | 'invalid';
  message?: string;
}

import type { TeamRosterPlayer } from '../api/invitations';

interface RegisterState {
  email: string;
  alias: string;
  password: string;
  role: UserRole | '';
  trialAccepted: boolean;
  trialModalVisible: boolean;
  coachHasClubCode: boolean | null;
  invitationCode: string;
  codeValidation: CodeValidationState;
  rosterPlayers: TeamRosterPlayer[];
  selectedTeamPlayerId: string | null;
  submitting: boolean;
  error: string | null;
  successMessage: string | null;
  pendingApproval: boolean;
}

type RegisterAction =
  | { type: 'SET_EMAIL'; payload: string }
  | { type: 'SET_ALIAS'; payload: string }
  | { type: 'SET_PASSWORD'; payload: string }
  | { type: 'SET_ROLE'; payload: UserRole | '' }
  | { type: 'SET_COACH_HAS_CLUB_CODE'; payload: boolean | null }
  | { type: 'SET_INVITATION_CODE'; payload: string }
  | { type: 'SET_CODE_VALIDATION'; payload: CodeValidationState }
  | { type: 'SET_ROSTER_PLAYERS'; payload: TeamRosterPlayer[] }
  | { type: 'SET_SELECTED_TEAM_PLAYER'; payload: string | null }
  | { type: 'SHOW_TRIAL_MODAL' }
  | { type: 'ACCEPT_TRIAL' }
  | { type: 'CANCEL_TRIAL' }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS_ACTIVE' }
  | { type: 'SUBMIT_SUCCESS_PENDING' }
  | { type: 'SUBMIT_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' };

const initialState: RegisterState = {
  email: '',
  alias: '',
  password: '',
  role: '',
  trialAccepted: false,
  trialModalVisible: false,
  coachHasClubCode: null,
  invitationCode: '',
  codeValidation: { status: 'idle' },
  rosterPlayers: [],
  selectedTeamPlayerId: null,
  submitting: false,
  error: null,
  successMessage: null,
  pendingApproval: false,
};

function registerReducer(state: RegisterState, action: RegisterAction): RegisterState {
  switch (action.type) {
    case 'SET_EMAIL':
      return { ...state, email: action.payload, error: null };
    case 'SET_ALIAS':
      return { ...state, alias: action.payload, error: null };
    case 'SET_PASSWORD':
      return { ...state, password: action.payload, error: null };
    case 'SET_ROLE': {
      return {
        ...state,
        role: action.payload,
        trialAccepted: false,
        trialModalVisible: false,
        coachHasClubCode: null,
        invitationCode: '',
        codeValidation: { status: 'idle' },
        rosterPlayers: [],
        selectedTeamPlayerId: null,
        error: null,
      };
    }
    case 'SET_COACH_HAS_CLUB_CODE':
      return { ...state, coachHasClubCode: action.payload, error: null };
    case 'SET_INVITATION_CODE':
      return { ...state, invitationCode: action.payload, error: null };
    case 'SET_CODE_VALIDATION':
      return { ...state, codeValidation: action.payload };
    case 'SET_ROSTER_PLAYERS':
      return { ...state, rosterPlayers: action.payload };
    case 'SET_SELECTED_TEAM_PLAYER':
      return { ...state, selectedTeamPlayerId: action.payload, error: null };
    case 'SHOW_TRIAL_MODAL':
      return { ...state, trialModalVisible: true };
    case 'ACCEPT_TRIAL':
      return { ...state, trialAccepted: true, trialModalVisible: false };
    case 'CANCEL_TRIAL':
      return {
        ...state,
        role: '',
        trialAccepted: false,
        trialModalVisible: false,
        coachHasClubCode: null,
        invitationCode: '',
        codeValidation: { status: 'idle' },
        rosterPlayers: [],
        selectedTeamPlayerId: null,
        error: null,
      };
    case 'SUBMIT_START':
      return { ...state, submitting: true };
    case 'SUBMIT_SUCCESS_ACTIVE':
      return { ...state, submitting: false, successMessage: 'Cuenta creada exitosamente' };
    case 'SUBMIT_SUCCESS_PENDING':
      return { ...state, submitting: false, pendingApproval: true };
    case 'SUBMIT_ERROR':
      return { ...state, submitting: false, error: action.payload };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

const RegisterScreen = () => {
  const [state, dispatch] = useReducer(registerReducer, initialState);
  const navigation = useNavigation<NavigationProp>();

  // Check if trial is required
  useEffect(() => {
    if (state.role === 'ClubDirector') {
      if (!state.trialAccepted && !state.trialModalVisible) {
        dispatch({ type: 'SHOW_TRIAL_MODAL' });
      }
    } else if (state.role === 'Coach') {
      if (state.coachHasClubCode === false && !state.trialAccepted && !state.trialModalVisible) {
        dispatch({ type: 'SHOW_TRIAL_MODAL' });
      }
    }
  }, [state.role, state.coachHasClubCode, state.trialAccepted, state.trialModalVisible]);

  // Debounced club code validation
  useEffect(() => {
    if (!state.invitationCode.trim()) {
      dispatch({
        type: 'SET_CODE_VALIDATION',
        payload: { status: 'idle' },
      });
      return;
    }

    if (state.role !== 'ClubMember' && state.role !== 'Coach') {
      return;
    }

    const timeoutId = setTimeout(async () => {
      dispatch({
        type: 'SET_CODE_VALIDATION',
        payload: { status: 'checking' },
      });

      try {
        await previewClubCode({
          code: state.invitationCode,
          membershipKind: state.role,
        });
        dispatch({
          type: 'SET_CODE_VALIDATION',
          payload: { status: 'valid' },
        });
      } catch (e: any) {
        const message = getRegisterErrorMessage(e);
        dispatch({
          type: 'SET_CODE_VALIDATION',
          payload: { status: 'invalid', message },
        });
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [state.invitationCode, state.role]);

  // Debounced team code validation
  useEffect(() => {
    if (!state.invitationCode.trim()) {
      dispatch({
        type: 'SET_CODE_VALIDATION',
        payload: { status: 'idle' },
      });
      dispatch({
        type: 'SET_ROSTER_PLAYERS',
        payload: [],
      });
      return;
    }

    if (state.role !== 'Player' && state.role !== 'FamilyMember') {
      return;
    }

    const timeoutId = setTimeout(async () => {
      dispatch({
        type: 'SET_CODE_VALIDATION',
        payload: { status: 'checking' },
      });

      try {
        const response = await previewTeamCode({
          code: state.invitationCode,
          membershipKind: state.role === 'Player' ? 'Player' : 'FamilyPlayer',
        });
        dispatch({
          type: 'SET_ROSTER_PLAYERS',
          payload: response.players,
        });
        dispatch({
          type: 'SET_CODE_VALIDATION',
          payload: { status: 'valid' },
        });
      } catch (e: any) {
        const message = getRegisterErrorMessage(e);
        dispatch({
          type: 'SET_CODE_VALIDATION',
          payload: { status: 'invalid', message },
        });
        dispatch({
          type: 'SET_ROSTER_PLAYERS',
          payload: [],
        });
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [state.invitationCode, state.role]);

  // Navigate to Login after successful Active registration
  useEffect(() => {
    if (state.successMessage) {
      const timeoutId = setTimeout(() => {
        navigation.navigate('Login');
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [state.successMessage, navigation]);

  const isFormValid =
    state.email.trim().length > 0 &&
    state.alias.trim().length > 0 &&
    state.password.trim().length > 0 &&
    state.role !== '';

  const isRoleSpecificValid = (): boolean => {
    if (state.role === 'Fan') return true;
    if (state.role === 'ClubDirector') return state.trialAccepted;
    if (state.role === 'Coach') {
      if (state.coachHasClubCode === null) return false;
      if (state.coachHasClubCode === false) return state.trialAccepted;
      return state.codeValidation.status === 'valid' && state.invitationCode.trim().length > 0;
    }
    if (state.role === 'ClubMember') {
      return state.codeValidation.status === 'valid' && state.invitationCode.trim().length > 0;
    }
    if (state.role === 'Player' || state.role === 'FamilyMember') {
      return (
        state.codeValidation.status === 'valid' &&
        state.invitationCode.trim().length > 0 &&
        state.selectedTeamPlayerId !== null
      );
    }
    return false;
  };

  const canSubmit = isFormValid && isRoleSpecificValid();

  const handleSubmit = async () => {
    if (!canSubmit) return;

    dispatch({ type: 'SUBMIT_START' });

    try {
      const payload: any = {
        email: state.email,
        alias: state.alias,
        password: state.password,
        accountType: state.role,
      };

      if (state.role === 'ClubDirector') {
        payload.trialAccepted = true;
      } else if (state.role === 'Coach') {
        payload.trialAccepted = state.trialAccepted;
        if (state.coachHasClubCode) {
          payload.clubInvitationCode = state.invitationCode;
        }
      } else if (state.role === 'ClubMember') {
        payload.clubInvitationCode = state.invitationCode;
      } else if (state.role === 'Player' || state.role === 'FamilyMember') {
        payload.teamInvitationCode = state.invitationCode;
        payload.teamPlayerId = state.selectedTeamPlayerId;
      }

      const response = await registerAccount(payload);

      if (response.status === 'Active') {
        dispatch({ type: 'SUBMIT_SUCCESS_ACTIVE' });
      } else if (response.status === 'PendingClubApproval') {
        dispatch({ type: 'SUBMIT_SUCCESS_PENDING' });
      }
    } catch (e: any) {
      const errorMessage = getRegisterErrorMessage(e);
      dispatch({ type: 'SUBMIT_ERROR', payload: errorMessage });
    }
  };

  return (
    <SafeAreaView testID="register-safe-area" style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        testID="register-keyboard-avoiding"
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
      <Text style={styles.title}>Registro</Text>

      {state.error && (
        <Text style={styles.errorText} testID="error-message">
          {state.error}
        </Text>
      )}

      {state.successMessage && (
        <Text style={styles.successText} testID="success-message">
          {state.successMessage}
        </Text>
      )}

      {state.pendingApproval && (
        <Text style={styles.pendingText} testID="pending-approval-notice">
          Tu solicitud de registro está pendiente de aprobación del club. Nos pondremos en
          contacto pronto.
        </Text>
      )}

      <TextInput
        testID="email-input"
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={coachColors.textSecondary}
        value={state.email}
        onChangeText={(text) => dispatch({ type: 'SET_EMAIL', payload: text })}
        editable={!state.submitting}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        testID="alias-input"
        style={styles.input}
        placeholder="Nombre de usuario"
        placeholderTextColor={coachColors.textSecondary}
        value={state.alias}
        onChangeText={(text) => dispatch({ type: 'SET_ALIAS', payload: text })}
        editable={!state.submitting}
        autoCapitalize="none"
      />

      <TextInput
        testID="password-input"
        style={styles.input}
        placeholder="Contraseña"
        placeholderTextColor={coachColors.textSecondary}
        value={state.password}
        onChangeText={(text) => dispatch({ type: 'SET_PASSWORD', payload: text })}
        editable={!state.submitting}
        secureTextEntry
      />

      <Text style={styles.sectionTitle}>Tipo de cuenta</Text>

      {(['Fan', 'ClubDirector', 'Coach', 'ClubMember', 'Player', 'FamilyMember'] as UserRole[]).map(
        (role) => (
          <Pressable
            key={role}
            testID={`role-${role}`}
            style={[
              styles.roleButton,
              state.role === role && styles.roleButtonSelected,
            ]}
            onPress={() => dispatch({ type: 'SET_ROLE', payload: role })}
            disabled={state.submitting}
          >
            <Text style={state.role === role ? styles.roleButtonTextSelected : styles.roleButtonText}>
              {role}
            </Text>
          </Pressable>
        ),
      )}

      {state.role === 'Coach' && (
        <View style={styles.coachCodeSection}>
          <Text style={styles.sectionTitle}>¿Tienes código de invitación?</Text>
          <Pressable
            testID="coach-has-code-yes"
            style={[
              styles.roleButton,
              state.coachHasClubCode === true && styles.roleButtonSelected,
            ]}
            onPress={() => dispatch({ type: 'SET_COACH_HAS_CLUB_CODE', payload: true })}
          >
            <Text
              style={
                state.coachHasClubCode === true ? styles.roleButtonTextSelected : styles.roleButtonText
              }
            >
              Sí
            </Text>
          </Pressable>
          <Pressable
            testID="coach-has-code-no"
            style={[
              styles.roleButton,
              state.coachHasClubCode === false && styles.roleButtonSelected,
            ]}
            onPress={() => dispatch({ type: 'SET_COACH_HAS_CLUB_CODE', payload: false })}
          >
            <Text
              style={
                state.coachHasClubCode === false ? styles.roleButtonTextSelected : styles.roleButtonText
              }
            >
              No
            </Text>
          </Pressable>
        </View>
      )}

      {((state.role === 'Coach' && state.coachHasClubCode === true) || state.role === 'ClubMember') && (
        <View style={styles.codeSection}>
          <Text style={styles.sectionTitle}>Código de invitación del club</Text>
          <TextInput
            testID="club-code-input"
            style={styles.input}
            placeholder="Código"
            placeholderTextColor={coachColors.textSecondary}
            value={state.invitationCode}
            onChangeText={(text) => dispatch({ type: 'SET_INVITATION_CODE', payload: text })}
            editable={!state.submitting}
          />
          <Text testID="club-code-status" style={styles.statusText}>
            {state.codeValidation.status === 'checking' && 'Verificando...'}
            {state.codeValidation.status === 'valid' && '✓ Código válido'}
            {state.codeValidation.status === 'invalid' && `✗ ${state.codeValidation.message}`}
          </Text>
        </View>
      )}

      {(state.role === 'Player' || state.role === 'FamilyMember') && (
        <View style={styles.codeSection}>
          <Text style={styles.sectionTitle}>Código de invitación del equipo</Text>
          <TextInput
            testID="team-code-input"
            style={styles.input}
            placeholder="Código"
            placeholderTextColor={coachColors.textSecondary}
            value={state.invitationCode}
            onChangeText={(text) => dispatch({ type: 'SET_INVITATION_CODE', payload: text })}
            editable={!state.submitting}
          />
          <Text testID="team-code-status" style={styles.statusText}>
            {state.codeValidation.status === 'checking' && 'Verificando...'}
            {state.codeValidation.status === 'valid' && '✓ Código válido'}
            {state.codeValidation.status === 'invalid' && `✗ ${state.codeValidation.message}`}
          </Text>
        </View>
      )}

      {(state.role === 'Player' || state.role === 'FamilyMember') &&
        state.codeValidation.status === 'valid' &&
        state.rosterPlayers.length > 0 && (
          <View style={styles.rosterSection}>
            <Text style={styles.sectionTitle}>Selecciona un jugador</Text>
            {state.rosterPlayers.map((player) => {
              const isDisabled =
                state.role === 'Player' && player.alreadyLinked;
              const isSelected = state.selectedTeamPlayerId === player.teamPlayerId;

              return (
                <Pressable
                  key={player.teamPlayerId}
                  testID={`roster-player-${player.teamPlayerId}`}
                  style={[
                    styles.playerButton,
                    isSelected && styles.playerButtonSelected,
                    isDisabled && styles.playerButtonDisabled,
                  ]}
                  onPress={() =>
                    dispatch({
                      type: 'SET_SELECTED_TEAM_PLAYER',
                      payload: player.teamPlayerId,
                    })
                  }
                  disabled={isDisabled || state.submitting}
                >
                  <Text
                    style={
                      isSelected
                        ? styles.playerButtonTextSelected
                        : isDisabled
                          ? styles.playerButtonTextDisabled
                          : styles.playerButtonText
                    }
                  >
                    {player.dorsal ? `#${player.dorsal} ` : ''}
                    {player.name} {player.lastName || ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

      <Pressable
        testID="register-button"
        style={[
          styles.button,
          !canSubmit && styles.buttonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!canSubmit || state.submitting}
      >
        <Text style={styles.buttonText} testID="register-button-text">
          {state.submitting ? 'Registrando...' : 'Registrarse'}
        </Text>
      </Pressable>

      <Modal visible={state.trialModalVisible} transparent animationType="fade" testID="trial-modal">
        <View style={styles.trialOverlay}>
          <View style={styles.trialModal}>
            <Text style={styles.trialTitle}>Prueba gratuita de 7 días</Text>
            <Text style={styles.trialMessage}>
              Accede a todas las funciones durante 7 días de forma gratuita.
            </Text>
            <Pressable
              testID="trial-accept-button"
              style={styles.trialButton}
              onPress={() => dispatch({ type: 'ACCEPT_TRIAL' })}
            >
              <Text style={styles.trialButtonText}>Aceptar</Text>
            </Pressable>
            <Pressable
              testID="trial-cancel-button"
              style={styles.trialCancelButton}
              onPress={() => dispatch({ type: 'CANCEL_TRIAL' })}
            >
              <Text style={styles.trialCancelButtonText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: coachColors.background,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: coachColors.background,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: coachColors.textPrimary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 15,
    marginBottom: 10,
    color: coachColors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: coachColors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 15,
    fontSize: 14,
    color: coachColors.textPrimary,
  },
  roleButton: {
    backgroundColor: coachColors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: coachColors.border,
  },
  roleButtonSelected: {
    backgroundColor: coachColors.primary,
    borderColor: coachColors.primary,
  },
  roleButtonText: {
    color: coachColors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  roleButtonTextSelected: {
    color: coachColors.contrastText,
    fontSize: 14,
    fontWeight: '500',
  },
  coachCodeSection: {
    marginTop: 15,
    marginBottom: 15,
  },
  codeSection: {
    marginTop: 15,
    marginBottom: 15,
  },
  rosterSection: {
    marginTop: 15,
    marginBottom: 15,
  },
  playerButton: {
    backgroundColor: coachColors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: coachColors.border,
  },
  playerButtonSelected: {
    backgroundColor: coachColors.primary,
    borderColor: coachColors.primary,
  },
  playerButtonDisabled: {
    opacity: 0.5,
  },
  playerButtonText: {
    color: coachColors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  playerButtonTextSelected: {
    color: coachColors.contrastText,
    fontSize: 14,
    fontWeight: '500',
  },
  playerButtonTextDisabled: {
    color: coachColors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  statusText: {
    fontSize: 13,
    color: coachColors.textSecondary,
    marginTop: 5,
  },
  button: {
    backgroundColor: coachColors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: coachColors.contrastText,
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: coachColors.error,
    marginBottom: 15,
    fontSize: 14,
  },
  successText: {
    color: '#4caf50',
    marginBottom: 15,
    fontSize: 14,
  },
  pendingText: {
    color: coachColors.accentOrange,
    marginBottom: 15,
    fontSize: 14,
  },
  trialOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trialModal: {
    backgroundColor: coachColors.background,
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    alignItems: 'center',
  },
  trialTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: coachColors.textPrimary,
    marginBottom: 10,
  },
  trialMessage: {
    fontSize: 14,
    color: coachColors.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  trialButton: {
    backgroundColor: coachColors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 10,
    width: '100%',
    alignItems: 'center',
  },
  trialButtonText: {
    color: coachColors.contrastText,
    fontSize: 14,
    fontWeight: '600',
  },
  trialCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: coachColors.border,
  },
  trialCancelButtonText: {
    color: coachColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default RegisterScreen;
