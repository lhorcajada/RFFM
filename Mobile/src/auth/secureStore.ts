import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';

export const saveToken = async (token: string): Promise<void> => {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
};

export const getToken = async (): Promise<string | null> => {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    return token ?? null;
  } catch (error) {
    console.error('Error retrieving token from secure store:', error);
    return null;
  }
};

export const deleteToken = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
};
