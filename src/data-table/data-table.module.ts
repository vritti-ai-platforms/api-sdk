import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '../cache/cache.module';
import { DataTableStateController } from './state/controllers/data-table-state.controller';
import { DataTableStateService } from './state/services/data-table-state.service';
import { DataTableViewsController } from './views/controllers/data-table-views.controller';
import { DataTableViewsRepository } from './views/repositories/data-table-views.repository';
import { DataTableViewsService } from './views/services/data-table-views.service';

@Module({
  imports: [ConfigModule, CacheModule],
  controllers: [DataTableStateController, DataTableViewsController],
  providers: [DataTableViewsService, DataTableViewsRepository, DataTableStateService],
  exports: [DataTableViewsService, DataTableStateService],
})
export class DataTableModule {}
