import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
import { RoomsModule } from './rooms/rooms.module.js';

@Module({
  imports: [RoomsModule],
  controllers: [HealthController],
})
export class AppModule {}
