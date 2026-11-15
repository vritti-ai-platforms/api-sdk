import type { SelectOptionsQueryDto } from './dto/select-options-query.dto';
import type { FindForSelectConfig } from './types/select-query.types';

type SelectPageKey = 'search' | 'limit' | 'offset' | 'values' | 'excludeIds' | 'withTotalCount';

export type SelectPageOptions = Pick<FindForSelectConfig, SelectPageKey>;

// The paging and search a select query carries, the same on every select endpoint — spread into a FindForSelectConfig
// beside the endpoint's own value, label, description, additional, group and sort choices, which stay explicit since
// they decide what the endpoint exposes
export function selectPageOptions(query: Pick<SelectOptionsQueryDto, SelectPageKey>): SelectPageOptions {
  return {
    search: query.search,
    limit: query.limit,
    offset: query.offset,
    values: query.values,
    excludeIds: query.excludeIds,
    withTotalCount: query.withTotalCount,
  };
}
