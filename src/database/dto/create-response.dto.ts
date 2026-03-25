import { ApiProperty } from '@nestjs/swagger';

// Generic wrapper for create/assign responses — includes success metadata alongside entity data
export class CreateResponseDto<T> {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Resource created successfully' })
  message!: string;

  @ApiProperty()
  data!: T;
}
