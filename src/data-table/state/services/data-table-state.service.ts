import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../../cache/cache.service';
import type { TableViewState } from '../../../database/filter/filter.types';
import type { UpsertDataTableStateDto } from '../dto/request/upsert-data-table-state.dto';

const EMPTY_TABLE_STATE: TableViewState = {
  filters: [],
  sort: [],
  columnVisibility: {},
  columnOrder: [],
  columnSizing: {},
  columnPinning: { left: [], right: [] },
  lockedColumnSizing: false,
  density: 'normal',
  filterOrder: [],
  filterVisibility: {},
  pagination: { limit: 20, offset: 0 },
};

@Injectable()
export class DataTableStateService {
  private readonly logger = new Logger(DataTableStateService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  // Returns configured TTL for live table state in seconds, defaulting to 3600 (1h)
  private get stateTtl(): number {
    return this.configService.get<number>('TABLE_STATE_CACHE_TTL') ?? 3600;
  }

  // Saves live table state and active view ID to Redis; DB is not written
  async upsertCurrentState(userId: string, dto: UpsertDataTableStateDto): Promise<void> {
    const key = `dt:${userId}:${dto.tableSlug}`;
    await this.cacheService.set(key, { state: dto.state, activeViewId: dto.activeViewId ?? null }, this.stateTtl);
    this.logger.log(`Cached live state for user: ${userId}, table: ${dto.tableSlug}`);
  }

  // Returns live table state and active view ID from Redis; returns empty state on miss — no DB query
  async getCurrentState(userId: string, tableSlug: string): Promise<{ state: TableViewState; activeViewId: string | null }> {
    const key = `dt:${userId}:${tableSlug}`;
    const cached = await this.cacheService.get<{ state: TableViewState; activeViewId: string | null }>(key);
    return cached ?? { state: EMPTY_TABLE_STATE, activeViewId: null };
  }
}
