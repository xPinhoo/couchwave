import { Lobby } from './components/Lobby';
import { CONTROLLER_URL } from './config';
import { useHostRoom } from './useHostRoom';

export default function App() {
  const room = useHostRoom();

  switch (room.status) {
    case 'connecting':
      return <p className="status">Connecting…</p>;
    case 'error':
      return <p className="status error">{room.message}</p>;
    case 'ready':
      return <Lobby lobby={room.lobby} controllerUrl={CONTROLLER_URL} />;
  }
}
