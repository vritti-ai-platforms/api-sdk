import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RenameDataTableViewDto {
  @ApiProperty({ description: 'New display name for the view', example: 'AWS Only' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}
