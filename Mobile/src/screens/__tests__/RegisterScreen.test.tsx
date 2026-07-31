import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import RegisterScreen from '../RegisterScreen';
import { registerAccount } from '../../api/register';

jest.mock('../../api/register');
jest.mock('../../api/invitations');

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockRegisterAccount = registerAccount as jest.Mock;

describe('RegisterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Layout', () => {
    it('renders content inside a SafeAreaView so the submit button clears the system navigation bar', async () => {
      const { getByTestId } = await render(<RegisterScreen />);

      expect(getByTestId('register-safe-area')).toBeTruthy();
    });

    it('wraps the form in a KeyboardAvoidingView so the keyboard does not cover the focused input', async () => {
      const { getByTestId } = await render(<RegisterScreen />);

      expect(getByTestId('register-keyboard-avoiding')).toBeTruthy();
    });
  });

  describe('Core fields and Fan role', () => {
    it('disables the submit button until all required fields are filled', async () => {
      const { getByTestId } = await render(<RegisterScreen />);

      const registerButton = getByTestId('register-button');
      expect(registerButton.props.accessibilityState.disabled).toBe(true);

      // Fill email
      await fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
      expect(getByTestId('register-button').props.accessibilityState.disabled).toBe(true);

      // Fill alias
      await fireEvent.changeText(getByTestId('alias-input'), 'testuser');
      expect(getByTestId('register-button').props.accessibilityState.disabled).toBe(true);

      // Fill password
      await fireEvent.changeText(getByTestId('password-input'), 'password123');
      expect(getByTestId('register-button').props.accessibilityState.disabled).toBe(true);

      // Select Fan role
      await fireEvent.press(getByTestId('role-Fan'));
      expect(getByTestId('register-button').props.accessibilityState.disabled).toBe(false);
    });

    it('submits a valid Fan registration with the correct payload', async () => {
      mockRegisterAccount.mockResolvedValue({
        userId: '123',
        roles: ['Fan'],
        status: 'Active' as const,
        subscription: null,
        clubJoinRequestId: null,
      });

      const { getByTestId } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
      await fireEvent.changeText(getByTestId('alias-input'), 'testuser');
      await fireEvent.changeText(getByTestId('password-input'), 'password123');
      await fireEvent.press(getByTestId('role-Fan'));

      await fireEvent.press(getByTestId('register-button'));

      await waitFor(() => {
        expect(mockRegisterAccount).toHaveBeenCalledWith({
          email: 'test@example.com',
          alias: 'testuser',
          password: 'password123',
          accountType: 'Fan',
        });
      });
    });

    it('disables the submit button while submission is in flight', async () => {
      mockRegisterAccount.mockImplementation(
        () =>
          new Promise<any>((resolve) => {
            setTimeout(() => {
              resolve({
                userId: '123',
                roles: ['Fan'],
                status: 'Active',
                subscription: null,
                clubJoinRequestId: null,
              });
            }, 100);
          }),
      );

      const { getByTestId } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
      await fireEvent.changeText(getByTestId('alias-input'), 'testuser');
      await fireEvent.changeText(getByTestId('password-input'), 'password123');
      await fireEvent.press(getByTestId('role-Fan'));

      await fireEvent.press(getByTestId('register-button'));

      // Button text should show loading immediately
      const buttonText = getByTestId('register-button-text');
      expect(buttonText.props.children).toBe('Registrando...');

      // Button should be disabled
      expect(getByTestId('register-button').props.accessibilityState.disabled).toBe(true);
    }, 10000);

    it('shows an error message when registration fails', async () => {
      mockRegisterAccount.mockRejectedValue({
        response: {
          data: {
            code: 'EmailIsAlreadyTaken',
            detail: 'Email already in use',
          },
        },
      });

      const { getByTestId, findByTestId } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
      await fireEvent.changeText(getByTestId('alias-input'), 'testuser');
      await fireEvent.changeText(getByTestId('password-input'), 'password123');
      await fireEvent.press(getByTestId('role-Fan'));

      await fireEvent.press(getByTestId('register-button'));

      const errorMessage = await findByTestId('error-message');
      expect(errorMessage.props.children).toBe(
        'Ese correo electrónico ya está registrado.',
      );
    });

    it('clears error message when a field is edited after a failed submission', async () => {
      mockRegisterAccount.mockRejectedValueOnce({
        response: {
          data: {
            code: 'EmailIsAlreadyTaken',
          },
        },
      });

      const { getByTestId, queryByTestId } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
      await fireEvent.changeText(getByTestId('alias-input'), 'testuser');
      await fireEvent.changeText(getByTestId('password-input'), 'password123');
      await fireEvent.press(getByTestId('role-Fan'));

      await fireEvent.press(getByTestId('register-button'));

      // Wait for error to appear
      await waitFor(() => {
        expect(queryByTestId('error-message')).toBeTruthy();
      });

      // Edit a field
      await fireEvent.changeText(getByTestId('email-input'), 'newemail@example.com');

      // Error should be cleared
      expect(queryByTestId('error-message')).toBeFalsy();
    });
  });

  describe('Success and pending outcomes', () => {
    it('shows success message and navigates to Login when status is Active', async () => {
      mockRegisterAccount.mockResolvedValue({
        userId: '123',
        roles: ['Fan'],
        status: 'Active' as const,
        subscription: null,
        clubJoinRequestId: null,
      });

      const { getByTestId, findByTestId } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
      await fireEvent.changeText(getByTestId('alias-input'), 'testuser');
      await fireEvent.changeText(getByTestId('password-input'), 'password123');
      await fireEvent.press(getByTestId('role-Fan'));

      await fireEvent.press(getByTestId('register-button'));

      const successMessage = await findByTestId('success-message');
      expect(successMessage.props.children).toBe('Cuenta creada exitosamente');

      // Navigation should be called after a delay (2 seconds)
      await waitFor(
        () => {
          expect(mockNavigate).toHaveBeenCalledWith('Login');
        },
        { timeout: 3000 },
      );
    }, 10000);

    it('shows pending approval notice and does not navigate when status is PendingClubApproval', async () => {
      mockRegisterAccount.mockResolvedValue({
        userId: '123',
        roles: ['ClubDirector'],
        status: 'PendingClubApproval' as const,
        subscription: null,
        clubJoinRequestId: 'request-123',
      });

      const { getByTestId, findByTestId } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
      await fireEvent.changeText(getByTestId('alias-input'), 'testuser');
      await fireEvent.changeText(getByTestId('password-input'), 'password123');
      await fireEvent.press(getByTestId('role-ClubDirector'));

      // Wait for trial modal
      await waitFor(() => {
        expect(getByTestId('trial-modal')).toBeTruthy();
      });

      await fireEvent.press(getByTestId('trial-accept-button'));
      await fireEvent.press(getByTestId('register-button'));

      const pendingNotice = await findByTestId('pending-approval-notice');
      expect(pendingNotice.props.children).toContain('Tu solicitud de registro está pendiente');

      // Navigation should NOT be called
      expect(mockNavigate).not.toHaveBeenCalledWith('Login');
    });
  });

  describe('Trial acceptance (ClubDirector and codeless Coach)', () => {
    it('shows trial modal when ClubDirector is selected', async () => {
      const { getByTestId } = await render(<RegisterScreen />);

      await fireEvent.press(getByTestId('role-ClubDirector'));

      await waitFor(() => {
        expect(getByTestId('trial-modal')).toBeTruthy();
      });
    });

    it('enables submit after accepting trial for ClubDirector', async () => {
      const { getByTestId } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
      await fireEvent.changeText(getByTestId('alias-input'), 'testuser');
      await fireEvent.changeText(getByTestId('password-input'), 'password123');

      await fireEvent.press(getByTestId('role-ClubDirector'));

      // Trial modal should be showing
      await waitFor(() => {
        expect(getByTestId('trial-modal')).toBeTruthy();
      });

      // Before accepting, button is disabled
      expect(getByTestId('register-button').props.accessibilityState.disabled).toBe(true);

      // Accept trial
      await fireEvent.press(getByTestId('trial-accept-button'));

      // After accepting, button should be enabled
      await waitFor(() => {
        expect(getByTestId('register-button').props.accessibilityState.disabled).toBe(false);
      });
    });

    it('resets role when cancelling trial', async () => {
      const { getByTestId, queryByTestId } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
      await fireEvent.changeText(getByTestId('alias-input'), 'testuser');
      await fireEvent.changeText(getByTestId('password-input'), 'password123');

      await fireEvent.press(getByTestId('role-ClubDirector'));

      await waitFor(() => {
        expect(getByTestId('trial-modal')).toBeTruthy();
      });

      await fireEvent.press(getByTestId('trial-cancel-button'));

      // Modal should close
      await waitFor(() => {
        expect(queryByTestId('trial-modal')).toBeFalsy();
      });

      // Role button should not be selected
      expect(getByTestId('role-ClubDirector').props.style[1]).toBeFalsy();
    });

    it('shows trial modal when Coach selects no club code', async () => {
      const { getByTestId } = await render(<RegisterScreen />);

      await fireEvent.press(getByTestId('role-Coach'));

      // Should see "do you have a code?" section
      await waitFor(() => {
        expect(getByTestId('coach-has-code-no')).toBeTruthy();
      });

      // Click "No"
      await fireEvent.press(getByTestId('coach-has-code-no'));

      // Trial modal should appear
      await waitFor(() => {
        expect(getByTestId('trial-modal')).toBeTruthy();
      });
    });
  });

  describe('Club code validation (Coach with code and ClubMember)', () => {
    it('validates club code with debounce for ClubMember', async () => {
      const { previewClubCode: mockPreviewClubCode } = require('../../api/invitations');
      mockPreviewClubCode.mockResolvedValue({
        clubId: 'club-1',
        clubName: 'FC Barcelona',
        membershipKind: 'ClubMember',
      });

      const { getByTestId, findByTestId } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
      await fireEvent.changeText(getByTestId('alias-input'), 'testuser');
      await fireEvent.changeText(getByTestId('password-input'), 'password123');

      await fireEvent.press(getByTestId('role-ClubMember'));

      await fireEvent.changeText(getByTestId('club-code-input'), 'CLUB123');

      // Code validation should show valid after debounce
      await waitFor(
        () => {
          const statusText = getByTestId('club-code-status');
          const childrenText = statusText.props.children?.toString() || '';
          expect(childrenText).toContain('Código válido');
        },
        { timeout: 1000 },
      );
    }, 10000);

    it('disables submit when club code is invalid for ClubMember', async () => {
      const { previewClubCode: mockPreviewClubCode } = require('../../api/invitations');
      mockPreviewClubCode.mockRejectedValue({
        response: {
          data: {
            code: 'ClubInvitationCodeInvalid',
          },
        },
      });

      const { getByTestId, findByTestId } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
      await fireEvent.changeText(getByTestId('alias-input'), 'testuser');
      await fireEvent.changeText(getByTestId('password-input'), 'password123');

      await fireEvent.press(getByTestId('role-ClubMember'));

      await fireEvent.changeText(getByTestId('club-code-input'), 'INVALID');

      await waitFor(
        () => {
          const statusText = getByTestId('club-code-status');
          const childrenText = statusText.props.children?.toString() || '';
          expect(childrenText).toContain('El código de invitación de club no es válido');
        },
        { timeout: 1000 },
      );

      // Button should be disabled
      expect(getByTestId('register-button').props.accessibilityState.disabled).toBe(true);
    }, 10000);
  });

  describe('Team code and roster picker (Player/FamilyMember)', () => {
    it('validates team code and shows roster picker for Player role', async () => {
      const { previewTeamCode: mockPreviewTeamCode } = require('../../api/invitations');
      mockPreviewTeamCode.mockResolvedValue({
        teamId: 'team-1',
        teamName: 'Barcelona B',
        clubId: 'club-1',
        membershipKind: 'Player',
        players: [
          {
            teamPlayerId: 'tp-1',
            playerId: 'p-1',
            name: 'John',
            lastName: 'Doe',
            urlPhoto: null,
            dorsal: 10,
            alreadyLinked: false,
          },
          {
            teamPlayerId: 'tp-2',
            playerId: 'p-2',
            name: 'Jane',
            lastName: 'Smith',
            urlPhoto: null,
            dorsal: 7,
            alreadyLinked: false,
          },
        ],
      });

      const { getByTestId, findByTestId } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
      await fireEvent.changeText(getByTestId('alias-input'), 'testuser');
      await fireEvent.changeText(getByTestId('password-input'), 'password123');

      await fireEvent.press(getByTestId('role-Player'));

      await fireEvent.changeText(getByTestId('team-code-input'), 'TEAM123');

      await waitFor(
        () => {
          const statusText = getByTestId('team-code-status');
          const childrenText = statusText.props.children?.toString() || '';
          expect(childrenText).toContain('Código válido');
        },
        { timeout: 1000 },
      );

      // Roster players should be selectable
      const player1Button = await findByTestId('roster-player-tp-1');
      expect(player1Button).toBeTruthy();
    }, 10000);

    it('disables already-linked players for Player role only', async () => {
      const { previewTeamCode: mockPreviewTeamCode } = require('../../api/invitations');
      mockPreviewTeamCode.mockResolvedValue({
        teamId: 'team-1',
        teamName: 'Barcelona B',
        clubId: 'club-1',
        membershipKind: 'Player',
        players: [
          {
            teamPlayerId: 'tp-1',
            playerId: 'p-1',
            name: 'John',
            lastName: 'Doe',
            urlPhoto: null,
            dorsal: 10,
            alreadyLinked: true,
          },
        ],
      });

      const { getByTestId, findByTestId } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
      await fireEvent.changeText(getByTestId('alias-input'), 'testuser');
      await fireEvent.changeText(getByTestId('password-input'), 'password123');

      await fireEvent.press(getByTestId('role-Player'));

      await fireEvent.changeText(getByTestId('team-code-input'), 'TEAM123');

      // Wait for status to show valid
      await waitFor(
        () => {
          const statusText = getByTestId('team-code-status');
          const childrenText = statusText.props.children?.toString() || '';
          expect(childrenText).toContain('Código válido');
        },
        { timeout: 1000 },
      );

      // Player button for already-linked should be disabled
      const player1Button = await findByTestId('roster-player-tp-1');
      expect(
        player1Button.props.disabled ||
          player1Button.props.accessibilityState?.disabled,
      ).toBe(true);
    }, 10000);

    it('allows already-linked players for FamilyMember role', async () => {
      const { previewTeamCode: mockPreviewTeamCode } = require('../../api/invitations');
      mockPreviewTeamCode.mockResolvedValue({
        teamId: 'team-1',
        teamName: 'Barcelona B',
        clubId: 'club-1',
        membershipKind: 'FamilyMember',
        players: [
          {
            teamPlayerId: 'tp-1',
            playerId: 'p-1',
            name: 'John',
            lastName: 'Doe',
            urlPhoto: null,
            dorsal: 10,
            alreadyLinked: true,
          },
        ],
      });

      const { getByTestId, findByTestId } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
      await fireEvent.changeText(getByTestId('alias-input'), 'testuser');
      await fireEvent.changeText(getByTestId('password-input'), 'password123');

      await fireEvent.press(getByTestId('role-FamilyMember'));

      await fireEvent.changeText(getByTestId('team-code-input'), 'TEAM123');

      // Wait for status to show valid
      await waitFor(
        () => {
          const statusText = getByTestId('team-code-status');
          const childrenText = statusText.props.children?.toString() || '';
          expect(childrenText).toContain('Código válido');
        },
        { timeout: 1000 },
      );

      // Player button should be enabled for FamilyMember
      const player1Button = await findByTestId('roster-player-tp-1');
      expect(
        player1Button.props.disabled ||
          player1Button.props.accessibilityState?.disabled,
      ).toBe(false);
    }, 10000);

    it('enables submit only when a roster player is selected', async () => {
      const { previewTeamCode: mockPreviewTeamCode } = require('../../api/invitations');
      mockPreviewTeamCode.mockResolvedValue({
        teamId: 'team-1',
        teamName: 'Barcelona B',
        clubId: 'club-1',
        membershipKind: 'Player',
        players: [
          {
            teamPlayerId: 'tp-1',
            playerId: 'p-1',
            name: 'John',
            lastName: 'Doe',
            urlPhoto: null,
            dorsal: 10,
            alreadyLinked: false,
          },
        ],
      });

      const { getByTestId, findByTestId } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
      await fireEvent.changeText(getByTestId('alias-input'), 'testuser');
      await fireEvent.changeText(getByTestId('password-input'), 'password123');

      await fireEvent.press(getByTestId('role-Player'));

      await fireEvent.changeText(getByTestId('team-code-input'), 'TEAM123');

      await findByTestId('team-code-status');

      // Before selecting player, button should be disabled
      expect(getByTestId('register-button').props.accessibilityState.disabled).toBe(true);

      // Select player
      const player1Button = await findByTestId('roster-player-tp-1');
      await fireEvent.press(player1Button);

      // After selecting player, button should be enabled
      await waitFor(() => {
        expect(getByTestId('register-button').props.accessibilityState.disabled).toBe(false);
      });
    });

    it('sends membershipKind "FamilyPlayer" to previewTeamCode for FamilyMember role', async () => {
      const { previewTeamCode: mockPreviewTeamCode } = require('../../api/invitations');
      mockPreviewTeamCode.mockResolvedValue({
        teamId: 'team-1',
        teamName: 'Barcelona B',
        clubId: 'club-1',
        membershipKind: 'FamilyPlayer',
        players: [],
      });

      const { getByTestId } = await render(<RegisterScreen />);

      await fireEvent.press(getByTestId('role-FamilyMember'));
      await fireEvent.changeText(getByTestId('team-code-input'), 'TEAM123');

      await waitFor(() => {
        expect(mockPreviewTeamCode).toHaveBeenCalledWith({
          code: 'TEAM123',
          membershipKind: 'FamilyPlayer',
        });
      });
    });

    it('sends teamPlayerId in payload when submitting Player registration', async () => {
      const { previewTeamCode: mockPreviewTeamCode } = require('../../api/invitations');
      mockPreviewTeamCode.mockResolvedValue({
        teamId: 'team-1',
        teamName: 'Barcelona B',
        clubId: 'club-1',
        membershipKind: 'Player',
        players: [
          {
            teamPlayerId: 'tp-1',
            playerId: 'p-1',
            name: 'John',
            lastName: 'Doe',
            urlPhoto: null,
            dorsal: 10,
            alreadyLinked: false,
          },
        ],
      });

      mockRegisterAccount.mockResolvedValue({
        userId: '123',
        roles: ['Player'],
        status: 'Active' as const,
        subscription: null,
        clubJoinRequestId: null,
      });

      const { getByTestId, findByTestId } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
      await fireEvent.changeText(getByTestId('alias-input'), 'testuser');
      await fireEvent.changeText(getByTestId('password-input'), 'password123');

      await fireEvent.press(getByTestId('role-Player'));

      await fireEvent.changeText(getByTestId('team-code-input'), 'TEAM123');

      await findByTestId('team-code-status');

      const player1Button = await findByTestId('roster-player-tp-1');
      await fireEvent.press(player1Button);

      await fireEvent.press(getByTestId('register-button'));

      await waitFor(() => {
        expect(mockRegisterAccount).toHaveBeenCalledWith({
          email: 'test@example.com',
          alias: 'testuser',
          password: 'password123',
          accountType: 'Player',
          teamInvitationCode: 'TEAM123',
          teamPlayerId: 'tp-1',
        });
      });
    });
  });
});
