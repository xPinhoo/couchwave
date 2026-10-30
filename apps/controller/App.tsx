import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { initialRoomCode } from './src/config';
import { StatusBanner } from './src/components/StatusBanner';
import { DrawScreen } from './src/screens/DrawScreen';
import { JoinScreen } from './src/screens/JoinScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { LobbyScreen } from './src/screens/LobbyScreen';
import { SetupScreen } from './src/screens/SetupScreen';
import { TriviaScreen } from './src/screens/TriviaScreen';
import { colors } from './src/theme';
import { isGame, useController } from './src/useController';

export default function App() {
  const { state, game, actionError, join, answer, drawing, react, setReady, leader, reset } =
    useController();

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        {state.status === 'lobby' && state.lobby.status === 'playing' && game ? (
          <>
            <StatusBanner
              connected={state.connected}
              screenConnected={state.lobby.screenConnected}
            />
            {isGame(game, 'trivia') ? (
              <TriviaScreen
                game={game}
                connected={state.connected}
                isLeader={state.lobby.leaderId === state.playerId}
                onAnswer={answer}
                onEnd={() => void leader.endGame()}
                onPlayAgain={() => void leader.playAgain()}
              />
            ) : isGame(game, 'draw') ? (
              <DrawScreen
                game={game}
                players={state.lobby.players}
                connected={state.connected}
                isLeader={state.lobby.leaderId === state.playerId}
                actions={drawing}
                onEnd={() => void leader.endGame()}
                onPlayAgain={() => void leader.playAgain()}
              />
            ) : null}
          </>
        ) : state.status === 'lobby' && state.lobby.status === 'playing' ? (
          // Joined or came back after the game started: they play the next one
          <View style={styles.centered}>
            <Text style={styles.message}>A game is in progress.</Text>
            <Text style={styles.hint}>Watch the TV — you'll be in the next one!</Text>
          </View>
        ) : state.status === 'lobby' && state.lobby.status === 'setup' ? (
          <SetupScreen
            playerId={state.playerId}
            lobby={state.lobby}
            connected={state.connected}
            error={actionError}
            onOptions={(options) => void leader.setOptions(options)}
            onReady={(ready) => void setReady(ready)}
            onCancel={() => void leader.cancelSetup()}
          />
        ) : state.status === 'lobby' && state.lobby.status === 'library' ? (
          <LibraryScreen
            playerId={state.playerId}
            lobby={state.lobby}
            connected={state.connected}
            error={actionError}
            onMove={(delta, axis) => void leader.moveLibrary(delta, axis)}
            onSelect={() => void leader.selectGame()}
            onBack={() => void leader.closeLibrary()}
            onReact={react}
          />
        ) : state.status === 'lobby' ? (
          <LobbyScreen
            playerId={state.playerId}
            lobby={state.lobby}
            connected={state.connected}
            error={actionError}
            onStart={() => void leader.openLibrary()}
            onKick={(id) => void leader.kick(id)}
            onReact={react}
          />
        ) : state.status === 'rejoining' ? (
          <View style={styles.centered}>
            <Text style={styles.message}>Reconnecting…</Text>
          </View>
        ) : state.status === 'closed' || state.status === 'kicked' ? (
          <View style={styles.centered}>
            <Text style={styles.message}>
              {state.status === 'kicked'
                ? 'The host removed you from the room.'
                : 'The room closed because the TV screen left.'}
            </Text>
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
  hint: {
    color: colors.muted,
    textAlign: 'center',
  },
  link: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
  },
});
