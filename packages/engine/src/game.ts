/**
 * Contract every mini-game implements. All functions are pure: the server owns
 * time and randomness and passes them in, so games are deterministic and easy to test.
 */
export interface GameModule<
  State,
  Input,
  Settings = void,
  HostView = unknown,
  PlayerView = unknown,
> {
  id: string;
  name: string;
  minPlayers: number;

  init(playerIds: string[], settings: Settings, now: number): State;
  onInput(state: State, playerId: string, input: Input, now: number): State;
  /** Called on a fixed interval to advance timers and phases. */
  onTick(state: State, now: number): State;
  isOver(state: State): boolean;

  /** What the big screen sees. */
  hostView(state: State): HostView;
  /** What a single phone sees — may include private info (e.g. your own secret answer). */
  playerView(state: State, playerId: string): PlayerView;
}
