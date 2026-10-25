import { Module } from '@nestjs/common';
import { reconnectGraceMs } from '../config.js';
import { RECONNECT_GRACE_MS } from './rooms.constants.js';
import { RoomsGateway } from './rooms.gateway.js';
import { RoomsService } from './rooms.service.js';

@Module({
  providers: [
    RoomsService,
    RoomsGateway,
    { provide: RECONNECT_GRACE_MS, useFactory: reconnectGraceMs },
  ],
})
export class RoomsModule {}
