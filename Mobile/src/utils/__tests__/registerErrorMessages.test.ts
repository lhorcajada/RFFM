import { getRegisterErrorMessage } from '../registerErrorMessages';

describe('getRegisterErrorMessage', () => {
  it('returns a specific Spanish message for AccountTypeRequired code', () => {
    const error = {
      response: {
        data: {
          code: 'AccountTypeRequired',
        },
      },
    };

    expect(getRegisterErrorMessage(error)).toBe(
      'Debes seleccionar un tipo de cuenta.',
    );
  });

  it('returns a specific Spanish message for AliasIsAlreadyTaken code', () => {
    const error = {
      response: {
        data: {
          code: 'AliasIsAlreadyTaken',
        },
      },
    };

    expect(getRegisterErrorMessage(error)).toBe(
      'Ese nombre de usuario ya está en uso.',
    );
  });

  it('returns a specific Spanish message for EmailIsAlreadyTaken code', () => {
    const error = {
      response: {
        data: {
          code: 'EmailIsAlreadyTaken',
        },
      },
    };

    expect(getRegisterErrorMessage(error)).toBe(
      'Ese correo electrónico ya está registrado.',
    );
  });

  it('returns a specific Spanish message for UserCreationFailed code', () => {
    const error = {
      response: {
        data: {
          code: 'UserCreationFailed',
        },
      },
    };

    expect(getRegisterErrorMessage(error)).toBe(
      'No se pudo crear la cuenta. Inténtalo de nuevo.',
    );
  });

  it('returns a specific Spanish message for TrialAcceptanceRequired code', () => {
    const error = {
      response: {
        data: {
          code: 'TrialAcceptanceRequired',
        },
      },
    };

    expect(getRegisterErrorMessage(error)).toBe(
      'Debes aceptar la prueba gratuita de 7 días.',
    );
  });

  it('returns a specific Spanish message for LinkedPlayerNotInTeam code', () => {
    const error = {
      response: {
        data: {
          code: 'LinkedPlayerNotInTeam',
        },
      },
    };

    expect(getRegisterErrorMessage(error)).toBe(
      'El jugador seleccionado no pertenece a este equipo.',
    );
  });

  it('returns a specific Spanish message for LinkedPlayerAlreadyClaimed code', () => {
    const error = {
      response: {
        data: {
          code: 'LinkedPlayerAlreadyClaimed',
        },
      },
    };

    expect(getRegisterErrorMessage(error)).toBe(
      'Ese jugador ya está vinculado a otra cuenta.',
    );
  });

  it('returns a specific Spanish message for ClubInvitationCodeNotAllowedForRole code', () => {
    const error = {
      response: {
        data: {
          code: 'ClubInvitationCodeNotAllowedForRole',
        },
      },
    };

    expect(getRegisterErrorMessage(error)).toBe(
      'Este rol no admite código de invitación de club.',
    );
  });

  it('returns a specific Spanish message for ClubInvitationCodeInvalid code', () => {
    const error = {
      response: {
        data: {
          code: 'ClubInvitationCodeInvalid',
        },
      },
    };

    expect(getRegisterErrorMessage(error)).toBe(
      'El código de invitación de club no es válido.',
    );
  });

  it('returns a specific Spanish message for TeamInvitationCodeNotAllowedForRole code', () => {
    const error = {
      response: {
        data: {
          code: 'TeamInvitationCodeNotAllowedForRole',
        },
      },
    };

    expect(getRegisterErrorMessage(error)).toBe(
      'Este rol no admite código de invitación de equipo.',
    );
  });

  it('returns a specific Spanish message for TeamInvitationCodeInvalid code', () => {
    const error = {
      response: {
        data: {
          code: 'TeamInvitationCodeInvalid',
        },
      },
    };

    expect(getRegisterErrorMessage(error)).toBe(
      'El código de invitación de equipo no es válido.',
    );
  });

  it('falls back to detail when code is unrecognized but detail is present', () => {
    const error = {
      response: {
        data: {
          code: 'UnrecognizedErrorCode',
          detail: 'Error de servidor desconocido',
        },
      },
    };

    expect(getRegisterErrorMessage(error)).toBe('Error de servidor desconocido');
  });

  it('falls back to generic message when neither code nor detail is present', () => {
    const error = {
      response: {
        data: {},
      },
    };

    expect(getRegisterErrorMessage(error)).toBe(
      'No se pudo completar el registro. Inténtalo de nuevo.',
    );
  });

  it('falls back to generic message when error is null or undefined', () => {
    expect(getRegisterErrorMessage(null)).toBe(
      'No se pudo completar el registro. Inténtalo de nuevo.',
    );

    expect(getRegisterErrorMessage(undefined)).toBe(
      'No se pudo completar el registro. Inténtalo de nuevo.',
    );
  });
});
