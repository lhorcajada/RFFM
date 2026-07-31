const CODE_MESSAGES: Record<string, string> = {
  AccountTypeRequired: 'Debes seleccionar un tipo de cuenta.',
  AliasIsAlreadyTaken: 'Ese nombre de usuario ya está en uso.',
  EmailIsAlreadyTaken: 'Ese correo electrónico ya está registrado.',
  UserCreationFailed: 'No se pudo crear la cuenta. Inténtalo de nuevo.',
  TrialAcceptanceRequired: 'Debes aceptar la prueba gratuita de 7 días.',
  LinkedPlayerNotInTeam: 'El jugador seleccionado no pertenece a este equipo.',
  LinkedPlayerAlreadyClaimed: 'Ese jugador ya está vinculado a otra cuenta.',
  ClubInvitationCodeNotAllowedForRole:
    'Este rol no admite código de invitación de club.',
  ClubInvitationCodeInvalid:
    'El código de invitación de club no es válido.',
  TeamInvitationCodeNotAllowedForRole:
    'Este rol no admite código de invitación de equipo.',
  TeamInvitationCodeInvalid:
    'El código de invitación de equipo no es válido.',
};

const GENERIC_FALLBACK =
  'No se pudo completar el registro. Inténtalo de nuevo.';

export function getRegisterErrorMessage(error: any): string {
  const code = error?.response?.data?.code;
  if (code && CODE_MESSAGES[code]) {
    return CODE_MESSAGES[code];
  }
  const detail = error?.response?.data?.detail;
  if (detail) {
    return detail;
  }
  return GENERIC_FALLBACK;
}
