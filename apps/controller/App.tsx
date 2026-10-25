import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { initialRoomCode } from './src/config';
import { JoinScreen } from './src/screens/JoinScreen';
import { LobbyScreen } from './src/screens/LobbyScreen';
import { colors } from './src/theme';
import { useController } from './src/useController';

export default function App() {
  const { state, join, reset } = useController();

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        {state.status === 'lobby' ? (
          <LobbyScreen playerId={state.playerId} lobby={state.lobby} connected={state.connected} />
        ) : state.status === 'rejoining' ? (
          <View style={styles.centered}>
            <Text style={styles.message}>Reconnecting…</Text>
          </View>
        ) : state.status === 'closed' ? (
          <View style={styles.centered}>
            <Text style={styles.message}>The host closed the room.</Text>
            <Pressable accessibilityRole="button" onPress={reset}>
              <Text style={styles.link}>Join another room</Text>
            </Pressable>
          </View>
        ) : (
          <JoinScreen
            initialRoomCode={initialRoomCode()}
            joining={state.status === 'joining'}
            error={state.status === 'idle' ? state.error : undefined}
            onJoin={join}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  message: {
    color: colors.text,
    fontSize: 20,
  },
  link: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
  },
});
