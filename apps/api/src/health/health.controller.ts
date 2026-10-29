import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    // The deployed commit (set by Render), so CI can tell when a new deploy is live
    return { status: 'ok', commit: process.env.RENDER_GIT_COMMIT ?? null };
  }
}
