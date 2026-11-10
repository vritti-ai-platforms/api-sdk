import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@vritti/api-sdk/cache';
import type { PgTable } from 'drizzle-orm/pg-core';
import { DATA_TABLE_VIEWS_TABLE } from './data-table.constants';
import { TableStateController } from './state/controllers/table-state.controller';
import { TableStateService } from './state/services/table-state.service';
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
      controllers: [TableStateController, DataTableViewsController],
      providers: [
        {
          provide: DATA_TABLE_VIEWS_TABLE,
          useValue: options.tableViews,
        },
        DataTableViewsService,
        DataTableViewsRepository,
        TableStateService,
      ],
      exports: [DataTableViewsService, TableStateService],
    };
  }
}
