import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@vritti/api-sdk/cache';
import { ContextStateController } from './controllers/context-state.controller';
import { ContextStateService } from './services/context-state.service';

@Global()
@Module({
  imports: [ConfigModule, CacheModule],
  controllers: [ContextStateController],
  providers: [ContextStateService],
  exports: [ContextStateService],
})
export class ContextStateModule {}
