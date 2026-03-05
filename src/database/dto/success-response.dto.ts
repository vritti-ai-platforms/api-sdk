import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class SuccessResponseDto {
  @ApiProperty({ example: true })
  @IsNotEmpty()
  @IsBoolean()
  success!: boolean;

  @ApiProperty({ example: 'Operation completed successfully' })
  @IsNotEmpty()
  @IsString()
  message!: string;
}
