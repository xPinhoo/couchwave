import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Where the API lives. Set EXPO_PUBLIC_API_URL in production; in development we
 * reuse the host the app was loaded from (the Metro server on your machine), so
 * Expo Go on a phone on the same Wi-Fi reaches the API without extra config.
 */
function devApiUrl(): string {
  if (Platform.OS === 'web') {
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  }
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `http://${devHost}:3000`;
}

export const API_URL: string = process.env.EXPO_PUBLIC_API_URL ?? devApiUrl();

/** Room code from a scanned QR link (`?room=ABCD`) when running in the browser. */
export function initialRoomCode(): string {
  if (Platform.OS !== 'web') return '';
  return new URLSearchParams(window.location.search).get('room') ?? '';
}
