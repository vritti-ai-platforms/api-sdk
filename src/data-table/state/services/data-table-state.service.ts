import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@vritti/api-sdk/cache';
import type { TableViewState } from '../../filter/filter.types';
import type { UpsertDataTableStateDto } from '../dto/request/upsert-data-table-state.dto';

// Redis key of one user's live state for one table
function stateKey(userId: string, tableSlug: string): string {
  return `table-state:${userId}:${tableSlug}`;
}

const EMPTY_TABLE_STATE: TableViewState = {
  filters: { panel: [], context: [] },
  sort: [],
  columnVisibility: {},
  columnOrder: [],
  columnSizing: {},
  columnPinning: { left: [], right: [] },
  lockedColumnSizing: false,
  density: 'normal',
  filterOrder: [],
  filterVisibility: {},
  search: null,
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
    await this.cacheService.set(
      stateKey(userId, dto.tableSlug),
      { state: dto.state, activeViewId: dto.activeViewId ?? null },
      this.stateTtl,
    );
    this.logger.log(`Cached live state for user: ${userId}, table: ${dto.tableSlug}`);
  }

  // Returns live table state and active view ID from Redis; an empty state on a miss — no DB query
  async getCurrentState(
    userId: string,
    tableSlug: string,
  ): Promise<{ state: TableViewState; activeViewId: string | null }> {
    const cached = await this.cacheService.get<{ state: TableViewState; activeViewId: string | null }>(
      stateKey(userId, tableSlug),
    );
    if (!cached) return { state: structuredClone(EMPTY_TABLE_STATE), activeViewId: null };
    return { state: cached.state, activeViewId: cached.activeViewId ?? null };
  }
}
