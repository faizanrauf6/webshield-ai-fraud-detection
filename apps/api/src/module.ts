import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ApiController } from './controller';
import { ScanService } from './service';
@Module({
  imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 180 }])],
  controllers: [ApiController],
  providers: [ScanService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
