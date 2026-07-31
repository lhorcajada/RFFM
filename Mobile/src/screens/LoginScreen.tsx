import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { coachColors } from '../theme/colors';

type NavigationProp = NativeStackNavigationProp<any>;

const LoginScreen = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const isFormValid = username.trim().length > 0 && password.trim().length > 0;

  const handleLogin = async () => {
    if (!isFormValid) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(username.trim(), password);
      navigation.navigate('TeamSwitcher');
    } catch (e: any) {
      const errorMessage =
        e.response?.data?.detail ||
        e.message ||
        'Error al iniciar sesión';
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FutbolBase</Text>
      <Text style={styles.subtitle}>Iniciar sesión</Text>

      {error && <Text style={styles.errorText} testID="error-message">{error}</Text>}

      <TextInput
        testID="username-input"
        style={styles.input}
        placeholder="Usuario"
        placeholderTextColor={coachColors.textSecondary}
        value={username}
        onChangeText={setUsername}
        editable={!loading}
        autoCapitalize="none"
      />

      <TextInput
        testID="password-input"
        style={styles.input}
        placeholder="Contraseña"
        placeholderTextColor={coachColors.textSecondary}
        value={password}
        onChangeText={setPassword}
        editable={!loading}
        secureTextEntry
      />

      <Pressable
        testID="login-button"
        style={[
          styles.button,
          !isFormValid && styles.buttonDisabled,
        ]}
        onPress={handleLogin}
        disabled={!isFormValid || loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Cargando...' : 'Iniciar sesión'}
        </Text>
      </Pressable>

      <Pressable
        testID="register-link"
        onPress={() => navigation.navigate('Register')}
        style={styles.registerLinkContainer}
      >
        <Text style={styles.registerLinkText}>¿No tienes cuenta? Regístrate</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: coachColors.background,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: coachColors.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    color: coachColors.textSecondary,
    marginBottom: 30,
    textAlign: 'center',
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
  button: {
    backgroundColor: coachColors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
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
  registerLinkContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerLinkText: {
    color: coachColors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default LoginScreen;
