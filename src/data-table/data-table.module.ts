import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { PgTable } from 'drizzle-orm/pg-core';
import { CacheModule } from '../cache/cache.module';
import { DATA_TABLE_VIEWS_TABLE } from './data-table.constants';
import { DataTableStateController } from './state/controllers/data-table-state.controller';
import { DataTableStateService } from './state/services/data-table-state.service';
import { DataTableViewsController } from './views/controllers/data-table-views.controller';
import { DataTableViewsRepository } from './views/repositories/data-table-views.repository';
import { DataTableViewsService } from './views/services/data-table-views.service';

export { DATA_TABLE_VIEWS_TABLE };

export interface DataTableModuleOptions {
  tableViews: PgTable;
}

@Module({})
export class DataTableModule {
  static forRoot(options: DataTableModuleOptions): DynamicModule {
    return {
      global: true,
      module: DataTableModule,
      imports: [ConfigModule, CacheModule],
      controllers: [DataTableStateController, DataTableViewsController],
      providers: [
        {
          provide: DATA_TABLE_VIEWS_TABLE,
          useValue: options.tableViews,
        },
        DataTableViewsService,
        DataTableViewsRepository,
        DataTableStateService,
      ],
      exports: [DataTableViewsService, DataTableStateService],
    };
  }
}
