import { Module } from '@nestjs/common';
import { reconnectGraceMs, screenGraceMs } from '../config.js';
import { GamesService } from './games.service.js';
import {
  DEFAULT_TRIVIA_CONFIG,
  RECONNECT_GRACE_MS,
  SCREEN_GRACE_MS,
  TRIVIA_CONFIG,
} from './rooms.constants.js';
import { RoomsGateway } from './rooms.gateway.js';
import { RoomsService } from './rooms.service.js';

@Module({
  providers: [
    RoomsService,
    GamesService,
    RoomsGateway,
    { provide: RECONNECT_GRACE_MS, useFactory: reconnectGraceMs },
    { provide: SCREEN_GRACE_MS, useFactory: screenGraceMs },
    { provide: TRIVIA_CONFIG, useValue: DEFAULT_TRIVIA_CONFIG },
  ],
})
export class RoomsModule {}
