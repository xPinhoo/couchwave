import { Module } from '@nestjs/common';
import { RoomsGateway } from './rooms.gateway.js';
import { RoomsService } from './rooms.service.js';

@Module({
  providers: [RoomsService, RoomsGateway],
})
export class RoomsModule {}
