import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { DataTableView } from '../../../schema/data-table-views.table';
import type { TableViewState } from '../../../../database/filter/filter.types';

export class DataTableViewDto {
  @ApiProperty({ description: 'View unique identifier' })
  id!: string;

  @ApiPropertyOptional({ description: 'Display name of the view', nullable: true })
  name!: string | null;

  @ApiProperty({ description: 'Slug of the table this view belongs to', example: 'cloud-providers' })
  tableSlug!: string;

  @ApiProperty({ description: 'Stored filter, sort, and column visibility state' })
  state!: TableViewState;

  @ApiProperty({ description: 'Whether the view is visible to all users', example: false })
  isShared!: boolean;

  @ApiProperty({ description: 'Whether the requesting user owns this view', example: true })
  isOwn!: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiPropertyOptional({ description: 'Last updated timestamp', nullable: true })
  updatedAt!: Date | null;

  // Creates a response DTO from a DataTableView entity, computing isOwn by comparing userId
  static from(view: DataTableView, userId: string): DataTableViewDto {
    const dto = new DataTableViewDto();
    dto.id = view.id;
    dto.name = view.name ?? null;
    dto.tableSlug = view.tableSlug;
    dto.state = view.state;
    dto.isShared = view.isShared;
    dto.isOwn = view.userId === userId;
    dto.createdAt = view.createdAt;
    dto.updatedAt = view.updatedAt ?? null;
    return dto;
  }
}
