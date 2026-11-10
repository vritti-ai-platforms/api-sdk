import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@vritti/api-sdk/cache';
import { type FilterCondition, lastPerField, mergeByField } from '@vritti/api-sdk/conditions';
import type { PatchContextStateDto } from '../dto/request/patch-context-state.dto';
import type { PutContextStateDto } from '../dto/request/put-context-state.dto';

// Redis key of one user's saved context for one view
function stateKey(userId: string, slug: string): string {
  return `context-state:${userId}:${slug}`;
}

@Injectable()
export class ContextStateService {
  private readonly logger = new Logger(ContextStateService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  // Returns the configured TTL for saved context in seconds, defaulting to 3600 (1h)
  private get stateTtl(): number {
    return this.configService.get<number>('CONTEXT_STATE_CACHE_TTL') ?? 3600;
  }

  // Replaces a user's saved context for a view
  async putContextState(userId: string, dto: PutContextStateDto): Promise<void> {
    await this.cacheService.set(stateKey(userId, dto.slug), lastPerField(dto.context), this.stateTtl);
    this.logger.log(`Saved context for user: ${userId}, view: ${dto.slug}`);
  }

  // Sets context conditions in a user's saved context for a view, each replacing the stored one on its field, keeping
  // the rest
  async patchContextState(userId: string, dto: PatchContextStateDto): Promise<void> {
    // Read through getOrThrow: if Redis fails, the patch fails too rather than saving over the stored context
    const read = await this.cacheService.getOrThrow<FilterCondition[]>(stateKey(userId, dto.slug));
    const stored = Array.isArray(read) ? read : [];
    await this.cacheService.set(stateKey(userId, dto.slug), mergeByField(stored, dto.context), this.stateTtl);
    this.logger.log(`Patched context for user: ${userId}, view: ${dto.slug}`);
  }

  // Returns a user's saved context for a view; none on a miss
  async getContextState(userId: string, slug: string): Promise<FilterCondition[]> {
    const stored = await this.cacheService.get<FilterCondition[]>(stateKey(userId, slug));
    return Array.isArray(stored) ? stored : [];
  }
}
