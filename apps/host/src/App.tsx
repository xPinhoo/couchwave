import { Lobby } from './components/Lobby';
import { TriviaHost } from './components/TriviaHost';
import { CONTROLLER_URL } from './config';
import { useHostRoom } from './useHostRoom';

export default function App() {
  const { room, game, startGame, endGame } = useHostRoom();

  switch (room.status) {
    case 'connecting':
      return <p className="status">Connecting…</p>;
    case 'error':
      return <p className="status error">{room.message}</p>;
    case 'ready':
      return room.lobby.status === 'playing' && game ? (
        <TriviaHost game={game} players={room.lobby.players} onEnd={() => void endGame()} />
      ) : (
        <Lobby lobby={room.lobby} controllerUrl={CONTROLLER_URL} onStart={startGame} />
      );
  }
}
