import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@vritti/api-sdk/cache';
import { mergeByField } from '@vritti/api-sdk/conditions';
import type { TableState } from '../../table-state.types';
import type { PatchTableStateDto } from '../dto/request/patch-table-state.dto';
import type { PutTableStateDto } from '../dto/request/put-table-state.dto';

// Redis key of one user's live state for one table
function stateKey(userId: string, tableSlug: string): string {
  return `table-state:${userId}:${tableSlug}`;
}

const EMPTY_TABLE_STATE: TableState = {
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
export class TableStateService {
  private readonly logger = new Logger(TableStateService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  // Returns configured TTL for live table state in seconds, defaulting to 3600 (1h)
  private get stateTtl(): number {
    return this.configService.get<number>('TABLE_STATE_CACHE_TTL') ?? 3600;
  }

  // Replaces a user's saved table state and active view in Redis; DB is not written
  async putTableState(userId: string, dto: PutTableStateDto): Promise<void> {
    await this.cacheService.set(
      stateKey(userId, dto.tableSlug),
      { state: dto.state, activeViewId: dto.activeViewId ?? null },
      this.stateTtl,
    );
    this.logger.log(`Cached live state for user: ${userId}, table: ${dto.tableSlug}`);
  }

  // Sets context conditions in a user's saved table state, each replacing the stored one on its field, keeping the rest
  async patchTableState(userId: string, dto: PatchTableStateDto): Promise<void> {
    // Read through getOrThrow: if Redis fails, the patch fails too rather than saving over the stored state
    const stored = await this.cacheService.getOrThrow<{ state: TableState; activeViewId: string | null }>(
      stateKey(userId, dto.tableSlug),
    );
    const state = stored?.state ?? structuredClone(EMPTY_TABLE_STATE);
    // A stored state is client-supplied, so either filter list may be missing
    const filters = {
      panel: state.filters?.panel ?? [],
      context: mergeByField(state.filters?.context ?? [], dto.context),
    };
    await this.cacheService.set(
      stateKey(userId, dto.tableSlug),
      { state: { ...state, filters }, activeViewId: stored?.activeViewId ?? null },
      this.stateTtl,
    );
    this.logger.log(`Patched table context for user: ${userId}, table: ${dto.tableSlug}`);
  }

  // Returns a user's saved table state and active view from Redis; an empty state on a miss — no DB query
  async getTableState(userId: string, tableSlug: string): Promise<{ state: TableState; activeViewId: string | null }> {
    const cached = await this.cacheService.get<{ state: TableState; activeViewId: string | null }>(
      stateKey(userId, tableSlug),
    );
    if (!cached) return { state: structuredClone(EMPTY_TABLE_STATE), activeViewId: null };
    return { state: cached.state, activeViewId: cached.activeViewId ?? null };
  }
}
