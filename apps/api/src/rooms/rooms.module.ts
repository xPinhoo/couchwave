import { Module } from '@nestjs/common';
import { gameConfig, reconnectGraceMs, screenGraceMs } from '../config.js';
import { GamesService } from './games.service.js';
import { GAME_CONFIG, RECONNECT_GRACE_MS, SCREEN_GRACE_MS } from './rooms.constants.js';
import { RoomsGateway } from './rooms.gateway.js';
import { RoomsService } from './rooms.service.js';

@Module({
  providers: [
    RoomsService,
    GamesService,
    RoomsGateway,
    { provide: RECONNECT_GRACE_MS, useFactory: reconnectGraceMs },
    { provide: SCREEN_GRACE_MS, useFactory: screenGraceMs },
    { provide: GAME_CONFIG, useFactory: gameConfig },
  ],
})
export class RoomsModule {}
